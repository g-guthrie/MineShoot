import { BlockFace, BlockFaceAxes, BlockTextureUri, MISSING_TEXTURE_URI } from "./BlockConstants";
import Assets from "../network/Assets";

export const textureUriToTextureUris = (textureUri: BlockTextureUri = MISSING_TEXTURE_URI): Record<BlockFace, BlockTextureUri> => {
  const uriParts = textureUri.split('/');
  const isSingleTexture = uriParts[uriParts.length - 1].includes('.');
  const baseUri = !textureUri.startsWith('http') && !textureUri.startsWith('/') ? Assets.toAssetUri(textureUri) : textureUri;

  return Object.entries(BlockFaceAxes).reduce((textureUris, [face, axis]) => {
    textureUris[face as BlockFace] = isSingleTexture ? baseUri : `${baseUri}/${axis}.png`;
    return textureUris;
  }, {} as Record<BlockFace, BlockTextureUri>);
};
