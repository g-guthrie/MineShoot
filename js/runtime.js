!function(){
"use strict";

var GameRuntime={};
var state={
  mode:"boot",
  previousMode:"menu",
  pointerLocked:!1,
  bootReady:!1,
  failedReason:"",
  authRequired:!1,
  captureState:"idle",
  captureError:""
};
var listeners=[];

function cloneState(){
  var mode=state.mode;
  return{
    mode:mode,
    previousMode:state.previousMode,
    pointerLocked:!!state.pointerLocked,
    fallbackInput:!1,
    bootReady:!!state.bootReady,
    failedReason:state.failedReason||"",
    authRequired:!!state.authRequired,
    captureState:state.captureState||"idle",
    captureError:state.captureError||"",
    overlayVisible:
      mode==="menu"||
      mode==="paused"||
      mode==="manual"||
      mode==="failed"||
      mode==="starting_lock",
    authVisible:mode==="auth",
    manualOpen:mode==="manual"
  };
}

function emit(){
  var snapshot=cloneState();
  for(var i=0;i<listeners.length;i++){
    try{listeners[i](snapshot);}catch(_err){}
  }
}

function setMode(nextMode){
  if(state.mode===nextMode)return;
  if(state.mode!=="manual"){
    state.previousMode=state.mode;
  }
  state.mode=nextMode;
}

function ensureMode(nextMode){
  if(state.mode!==nextMode){
    state.mode=nextMode;
  }
}

function hasFocusedTextInput(){
  var el=document.activeElement;
  if(!el)return!1;
  if(el.isContentEditable)return!0;
  var tag=(el.tagName||"").toUpperCase();
  return tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT";
}

function setCaptureState(next,errorText){
  state.captureState=next;
  state.captureError=errorText?String(errorText):"";
}

GameRuntime.init=function(options){
  options=options||{};
  if(typeof options.mode==="string"){
    state.mode=options.mode;
  }
  if(typeof options.authRequired==="boolean"){
    state.authRequired=options.authRequired;
  }
  setCaptureState(state.pointerLocked?"locked":"idle","");
  emit();
  return cloneState();
};

GameRuntime.subscribe=function(listener){
  if(typeof listener!=="function"){
    return function(){};
  }
  listeners.push(listener);
  try{listener(cloneState());}catch(_err){}
  return function(){
    var next=[];
    for(var i=0;i<listeners.length;i++){
      if(listeners[i]!==listener){
        next.push(listeners[i]);
      }
    }
    listeners=next;
  };
};

GameRuntime.getState=function(){
  return cloneState();
};

GameRuntime.canAcceptGameplayInput=function(){
  return state.mode==="running"&&state.pointerLocked&&!hasFocusedTextInput();
};

GameRuntime.dispatch=function(intent,payload){
  payload=payload||{};
  switch(intent){
    case"BOOT_BEGIN":
      state.bootReady=!1;
      state.failedReason="";
      setCaptureState("idle","");
      setMode("boot");
      break;
    case"BOOT_READY":
      state.bootReady=!0;
      if(state.mode==="boot"){
        setMode(state.authRequired?"auth":"menu");
      }
      break;
    case"BOOT_FAILED":
      state.bootReady=!1;
      state.failedReason=String(payload.reason||"unknown_startup_error");
      setMode("failed");
      break;
    case"AUTH_REQUIRED":
      state.authRequired=!0;
      if(state.mode!=="failed"){
        setMode("auth");
      }
      break;
    case"AUTH_OK":
    case"AUTH_SKIP_LOCAL":
      state.authRequired=!1;
      if(state.mode!=="failed"){
        setMode("menu");
      }
      break;
    case"START_REQUEST":
      if(
        state.mode==="menu"||
        state.mode==="paused"||
        state.mode==="manual"||
        state.mode==="running"
      ){
        setCaptureState("requesting","");
        setMode("starting_lock");
      }
      break;
    case"POINTER_LOCK_WAIT":
      setCaptureState("requesting","");
      if(state.mode!=="failed"&&state.mode!=="auth"){
        ensureMode("starting_lock");
      }
      break;
    case"START_SUCCESS":
      if(state.pointerLocked&&state.mode!=="failed"&&state.mode!=="auth"){
        setCaptureState("locked","");
        setMode("running");
      }
      break;
    case"POINTER_LOCK_GAINED":
      state.pointerLocked=!0;
      setCaptureState("locked","");
      if(state.mode!=="failed"&&state.mode!=="auth"){
        ensureMode("running");
      }
      break;
    case"POINTER_LOCK_LOST":
      state.pointerLocked=!1;
      if(state.mode!=="starting_lock"){
        setCaptureState("lost","");
      }
      if(state.mode==="running"){
        setMode("paused");
      }
      break;
    case"POINTER_LOCK_DENIED":
      state.pointerLocked=!1;
      setCaptureState("denied",payload.reason||"POINTER LOCK DENIED - CLICK PLAY TO RETRY");
      if(state.mode==="starting_lock"){
        setMode(state.previousMode==="menu"?"menu":"paused");
      }
      break;
    case"POINTER_LOCK_UNSUPPORTED":
      state.pointerLocked=!1;
      setCaptureState("unsupported",payload.reason||"POINTER LOCK UNSUPPORTED IN THIS BROWSER");
      if(state.mode==="starting_lock"){
        setMode("menu");
      }
      break;
    case"PAUSE":
      if(state.mode==="running"){
        setMode("paused");
      }
      break;
    case"RESUME":
      if(state.mode==="paused"||state.mode==="manual"){
        setCaptureState("requesting","");
        setMode("starting_lock");
      }
      break;
    case"MANUAL_OPEN":
      if(state.mode==="manual")break;
      if(
        state.mode==="menu"||
        state.mode==="paused"||
        state.mode==="running"||
        state.mode==="starting_lock"
      ){
        state.previousMode=state.mode;
        state.mode="manual";
      }
      break;
    case"MANUAL_CLOSE":
      if(state.mode!=="manual")break;
      var prev=state.previousMode||"menu";
      state.mode=prev==="running"||prev==="starting_lock"?"paused":prev;
      break;
    case"FORCE_MENU":
      if(state.mode!=="failed"){
        setMode("menu");
      }
      break;
  }
  emit();
  return cloneState();
};

window.GameRuntime=GameRuntime;
}();
