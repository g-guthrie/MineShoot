/**
 * three-model-loader.js - Minimal embedded glTF to Three.js scene conversion for runtime assets.
 * Loaded as global: globalThis.__MAYHEM_RUNTIME.GameThreeModelLoader
 */
(function () {
    'use strict';

    var runtime = globalThis.__MAYHEM_RUNTIME = globalThis.__MAYHEM_RUNTIME || {};
    var GameThreeModelLoader = {};

    var jsonCache = new Map();
    var sceneCache = new Map();
    var textureCache = new Map();
    var tmpCenter = new THREE.Vector3();
    var tmpBox = new THREE.Box3();

    var COMPONENT_CTORS = {
        5120: Int8Array,
        5121: Uint8Array,
        5122: Int16Array,
        5123: Uint16Array,
        5125: Uint32Array,
        5126: Float32Array
    };

    var COMPONENT_BYTES = {
        5120: 1,
        5121: 1,
        5122: 2,
        5123: 2,
        5125: 4,
        5126: 4
    };

    var ACCESSOR_SIZES = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
        MAT2: 4,
        MAT3: 9,
        MAT4: 16
    };

    function hasWindowLocation() {
        return typeof window !== 'undefined' && !!window.location;
    }

    function resolveUrl(url, baseUrl) {
        try {
            return new URL(String(url || ''), baseUrl || (hasWindowLocation() ? window.location.href : 'http://localhost/')).href;
        } catch (_err) {
            return String(url || '');
        }
    }

    function loadJson(url) {
        var resolved = resolveUrl(url);
        if (!jsonCache.has(resolved)) {
            jsonCache.set(resolved, fetch(resolved).then(function (response) {
                if (!response.ok) throw new Error('Failed to load model JSON: ' + resolved);
                return response.json();
            }));
        }
        return jsonCache.get(resolved);
    }

    function decodeDataUriToArrayBuffer(uri) {
        var parts = String(uri || '').split(',');
        if (parts.length < 2) throw new Error('Invalid data URI buffer.');
        var binary = atob(parts[1]);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function loadBuffer(bufferDef, baseUrl) {
        if (!bufferDef || !bufferDef.uri) return Promise.resolve(new ArrayBuffer(0));
        var uri = String(bufferDef.uri);
        if (uri.indexOf('data:') === 0) {
            return Promise.resolve(decodeDataUriToArrayBuffer(uri));
        }
        return fetch(resolveUrl(uri, baseUrl)).then(function (response) {
            if (!response.ok) throw new Error('Failed to load model buffer: ' + uri);
            return response.arrayBuffer();
        });
    }

    function wrapToThree(wrapMode) {
        if (wrapMode === 33071) return THREE.ClampToEdgeWrapping;
        if (wrapMode === 33648) return THREE.MirroredRepeatWrapping;
        return THREE.RepeatWrapping;
    }

    function filterToThree(filterMode, fallback) {
        if (filterMode === 9728) return THREE.NearestFilter;
        if (filterMode === 9729) return THREE.LinearFilter;
        if (filterMode === 9984) return THREE.NearestMipmapNearestFilter;
        if (filterMode === 9985) return THREE.LinearMipmapNearestFilter;
        if (filterMode === 9986) return THREE.NearestMipmapLinearFilter;
        if (filterMode === 9987) return THREE.LinearMipmapLinearFilter;
        return fallback;
    }

    function loadTextureForImage(imageDef, samplerDef, baseUrl, cacheKey) {
        var resolved = resolveUrl(imageDef && imageDef.uri ? imageDef.uri : '', baseUrl);
        var key = cacheKey || (resolved + '::' + JSON.stringify(samplerDef || {}));
        if (!textureCache.has(key)) {
            textureCache.set(key, new Promise(function (resolve, reject) {
                var loader = new THREE.TextureLoader();
                loader.load(
                    resolved,
                    function (texture) {
                        texture.flipY = false;
                        if (typeof THREE.SRGBColorSpace === 'string') {
                            texture.colorSpace = THREE.SRGBColorSpace;
                        }
                        texture.wrapS = wrapToThree(samplerDef && samplerDef.wrapS);
                        texture.wrapT = wrapToThree(samplerDef && samplerDef.wrapT);
                        texture.magFilter = filterToThree(samplerDef && samplerDef.magFilter, THREE.LinearFilter);
                        texture.minFilter = filterToThree(samplerDef && samplerDef.minFilter, THREE.LinearMipmapLinearFilter);
                        texture.needsUpdate = true;
                        resolve(texture);
                    },
                    undefined,
                    function () {
                        reject(new Error('Failed to load model texture: ' + resolved));
                    }
                );
            }));
        }
        return textureCache.get(key);
    }

    function loadTextures(gltf, baseUrl) {
        var textures = gltf && Array.isArray(gltf.textures) ? gltf.textures : [];
        var images = gltf && Array.isArray(gltf.images) ? gltf.images : [];
        var samplers = gltf && Array.isArray(gltf.samplers) ? gltf.samplers : [];
        return Promise.all(textures.map(function (textureDef, textureIndex) {
            var imageDef = images[textureDef && textureDef.source];
            if (!imageDef || !imageDef.uri) return Promise.resolve(null);
            var samplerDef = samplers[textureDef && textureDef.sampler] || null;
            return loadTextureForImage(imageDef, samplerDef, baseUrl, resolveUrl(imageDef.uri, baseUrl) + '::' + textureIndex);
        }));
    }

    function accessorItemSize(accessor) {
        return ACCESSOR_SIZES[String(accessor && accessor.type || 'SCALAR')] || 1;
    }

    function readComponent(view, componentType, byteOffset) {
        if (componentType === 5120) return view.getInt8(byteOffset);
        if (componentType === 5121) return view.getUint8(byteOffset);
        if (componentType === 5122) return view.getInt16(byteOffset, true);
        if (componentType === 5123) return view.getUint16(byteOffset, true);
        if (componentType === 5125) return view.getUint32(byteOffset, true);
        return view.getFloat32(byteOffset, true);
    }

    function buildAccessorArray(gltf, buffers, accessorIndex) {
        var accessor = gltf.accessors[accessorIndex];
        var bufferView = gltf.bufferViews[accessor.bufferView];
        var componentType = Number(accessor.componentType || 5126);
        var itemSize = accessorItemSize(accessor);
        var componentBytes = COMPONENT_BYTES[componentType] || 4;
        var stride = Number(bufferView.byteStride || (itemSize * componentBytes));
        var ctor = COMPONENT_CTORS[componentType] || Float32Array;
        var source = buffers[bufferView.buffer];
        var byteOffset = Number(bufferView.byteOffset || 0) + Number(accessor.byteOffset || 0);
        var totalCount = Number(accessor.count || 0) * itemSize;

        if (stride === itemSize * componentBytes) {
            return new ctor(source, byteOffset, totalCount);
        }

        var out = new ctor(totalCount);
        var view = new DataView(source, byteOffset, Number(accessor.count || 0) * stride);
        for (var i = 0; i < Number(accessor.count || 0); i++) {
            for (var j = 0; j < itemSize; j++) {
                out[(i * itemSize) + j] = readComponent(view, componentType, (i * stride) + (j * componentBytes));
            }
        }
        return out;
    }

    function buildAttribute(gltf, buffers, accessorIndex) {
        var accessor = gltf.accessors[accessorIndex];
        if (!accessor) return null;
        return new THREE.BufferAttribute(buildAccessorArray(gltf, buffers, accessorIndex), accessorItemSize(accessor));
    }

    function buildGeometry(gltf, buffers, primitive) {
        var geometry = new THREE.BufferGeometry();
        var attrs = primitive && primitive.attributes ? primitive.attributes : {};
        if (typeof attrs.POSITION === 'number') geometry.setAttribute('position', buildAttribute(gltf, buffers, attrs.POSITION));
        if (typeof attrs.NORMAL === 'number') geometry.setAttribute('normal', buildAttribute(gltf, buffers, attrs.NORMAL));
        if (typeof attrs.TEXCOORD_0 === 'number') geometry.setAttribute('uv', buildAttribute(gltf, buffers, attrs.TEXCOORD_0));
        if (typeof primitive.indices === 'number') geometry.setIndex(buildAttribute(gltf, buffers, primitive.indices));
        if (!geometry.getAttribute('normal') && geometry.getAttribute('position')) {
            geometry.computeVertexNormals();
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return geometry;
    }

    function colorFromFactor(baseColorFactor) {
        if (!Array.isArray(baseColorFactor) || baseColorFactor.length < 3) return new THREE.Color(0xffffff);
        return new THREE.Color(baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]);
    }

    function buildMaterial(gltf, materialIndex, textures) {
        var materialDef = gltf.materials && gltf.materials[materialIndex] ? gltf.materials[materialIndex] : {};
        var pbr = materialDef.pbrMetallicRoughness || {};
        var baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
        var spec = {
            color: colorFromFactor(baseColorFactor),
            metalness: typeof pbr.metallicFactor === 'number' ? pbr.metallicFactor : 0,
            roughness: typeof pbr.roughnessFactor === 'number' ? pbr.roughnessFactor : 1
        };
        if (baseColorFactor.length > 3 && typeof baseColorFactor[3] === 'number' && baseColorFactor[3] < 1) {
            spec.transparent = true;
            spec.opacity = baseColorFactor[3];
        }
        if (pbr.baseColorTexture && textures[pbr.baseColorTexture.index]) {
            spec.map = textures[pbr.baseColorTexture.index];
        }
        if (materialDef.alphaMode === 'MASK') {
            spec.alphaTest = typeof materialDef.alphaCutoff === 'number' ? materialDef.alphaCutoff : 0.5;
        } else if (materialDef.alphaMode === 'BLEND') {
            spec.transparent = true;
        }
        var material = new THREE.MeshStandardMaterial(spec);
        material.name = String(materialDef.name || ('material-' + materialIndex));
        return material;
    }

    function buildMesh(gltf, buffers, textures, meshIndex) {
        var meshDef = gltf.meshes[meshIndex];
        var primitives = meshDef && Array.isArray(meshDef.primitives) ? meshDef.primitives : [];
        if (primitives.length === 1) {
            var primitive = primitives[0];
            var mesh = new THREE.Mesh(
                buildGeometry(gltf, buffers, primitive),
                buildMaterial(gltf, primitive.material, textures)
            );
            mesh.name = String(meshDef.name || ('mesh-' + meshIndex));
            return mesh;
        }

        var group = new THREE.Group();
        group.name = String(meshDef && meshDef.name || ('mesh-group-' + meshIndex));
        for (var i = 0; i < primitives.length; i++) {
            var childPrimitive = primitives[i];
            var childMesh = new THREE.Mesh(
                buildGeometry(gltf, buffers, childPrimitive),
                buildMaterial(gltf, childPrimitive.material, textures)
            );
            childMesh.name = group.name + '-primitive-' + i;
            group.add(childMesh);
        }
        return group;
    }

    function buildNode(gltf, buffers, textures, nodeIndex) {
        var nodeDef = gltf.nodes[nodeIndex] || {};
        var object = (typeof nodeDef.mesh === 'number')
            ? buildMesh(gltf, buffers, textures, nodeDef.mesh)
            : new THREE.Group();

        object.name = String(nodeDef.name || object.name || ('node-' + nodeIndex));
        if (Array.isArray(nodeDef.translation) && nodeDef.translation.length >= 3) {
            object.position.set(nodeDef.translation[0], nodeDef.translation[1], nodeDef.translation[2]);
        }
        if (Array.isArray(nodeDef.rotation) && nodeDef.rotation.length >= 4) {
            object.quaternion.set(nodeDef.rotation[0], nodeDef.rotation[1], nodeDef.rotation[2], nodeDef.rotation[3]);
        }
        if (Array.isArray(nodeDef.scale) && nodeDef.scale.length >= 3) {
            object.scale.set(nodeDef.scale[0], nodeDef.scale[1], nodeDef.scale[2]);
        }
        if (Array.isArray(nodeDef.children)) {
            for (var i = 0; i < nodeDef.children.length; i++) {
                object.add(buildNode(gltf, buffers, textures, nodeDef.children[i]));
            }
        }
        return object;
    }

    function finalizeScene(scene) {
        scene.traverse(function (node) {
            if (!node || !node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;
        });
        return scene;
    }

    function buildSceneFromGltf(gltf, baseUrl) {
        var buffers = Array.isArray(gltf && gltf.buffers) ? gltf.buffers : [];
        return Promise.all(buffers.map(function (bufferDef) {
            return loadBuffer(bufferDef, baseUrl);
        })).then(function (bufferData) {
            return loadTextures(gltf, baseUrl).then(function (textures) {
                var sceneDef = gltf.scenes && gltf.scenes[gltf.scene || 0] ? gltf.scenes[gltf.scene || 0] : { nodes: [] };
                var root = new THREE.Group();
                root.name = String(sceneDef.name || 'embedded-gltf-root');
                var sceneNodes = Array.isArray(sceneDef.nodes) ? sceneDef.nodes : [];
                for (var i = 0; i < sceneNodes.length; i++) {
                    root.add(buildNode(gltf, bufferData, textures, sceneNodes[i]));
                }
                return finalizeScene(root);
            });
        });
    }

    function cloneSceneGraph(scene, options) {
        var clone = scene.clone(true);
        var opts = options || {};
        var center = opts.center !== false;
        if (center) {
            clone.updateMatrixWorld(true);
            tmpBox.setFromObject(clone);
            if (isFinite(tmpBox.min.x) && isFinite(tmpBox.max.x)) {
                tmpBox.getCenter(tmpCenter);
                clone.position.sub(tmpCenter);
            }
        }
        clone.updateMatrixWorld(true);
        finalizeScene(clone);
        return clone;
    }

    GameThreeModelLoader.load = function (spec) {
        var modelSpec = spec || {};
        var url = String(modelSpec.url || '');
        if (!url) return Promise.resolve(null);
        var resolved = resolveUrl(url);
        if (!sceneCache.has(resolved)) {
            sceneCache.set(resolved, loadJson(resolved).then(function (gltf) {
                return buildSceneFromGltf(gltf, resolved);
            }));
        }
        return sceneCache.get(resolved).then(function (scene) {
            return cloneSceneGraph(scene, modelSpec);
        });
    };

    runtime.GameThreeModelLoader = GameThreeModelLoader;
})();
