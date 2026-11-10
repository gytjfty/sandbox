export class FrameGate {
 constructor(gl,clock=()=>performance.now()){this.gl=gl;this.clock=clock;this.sync=null;this.lost=false;this.submittedAt=0;this.lastMilliseconds=0;}
 markLost(){this.lost=true;this.sync=null;}
 poll(){if(this.lost)return 'lost';const g=this.gl;if(g.isContextLost()){this.markLost();return 'lost';}if(!this.sync)return 'ready';const s=g.clientWaitSync(this.sync,0,0);if(s===g.TIMEOUT_EXPIRED)return 'pending';if(s===g.ALREADY_SIGNALED||s===g.CONDITION_SATISFIED){g.deleteSync(this.sync);this.sync=null;this.lastMilliseconds=this.clock()-this.submittedAt;return 'ready';}return 'failed';}
 submit(){if(this.lost)throw Error('Context is lost; no frame submitted.');if(this.sync)throw Error('A GPU frame is already pending.');this.sync=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!this.sync)throw Error('Unable to create GPU completion fence.');this.submittedAt=this.clock();this.gl.flush();}
 dispose(){if(!this.lost&&this.sync)this.gl.deleteSync(this.sync);this.sync=null;}
}
