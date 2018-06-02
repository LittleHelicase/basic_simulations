
var h = 0.4;
var r = 14;
var m = 0.2;
var noGravSteps = 0;
var steps = 5000;
var dt = 0.001;

function initializeTopLine(h,r){
  var p = [];
  for(x=-r*1.6; x<r*1.6; x+=h*0.5){
    p.push([x,0]);
  }
  var start = 40; var end = 60;
  for(var x = -r*0.8; x<r*0.8; x+=0.5*h){
    p.push([x,end]);
  }
  for(var y=start; y<end; y+=0.5*h){
    p.push([-r*0.8,y]);
    p.push([r*0.8,y]);
  }
  return p;
}

function initializeHalfCircle(h,r){
  var validPos = function(x,y){
    return y > 0 && x*x + y*y < r*r;
  }

  var p = [];
  var v = []
  for(var x=-r; x<r; x+=h){
    for(var y=h; y<r; y+=h){
      if(validPos(x,y)){
        p.push([x,y]);
        v.push([0,0]);
      }
    }
  }
  return {positions: p, velocities: v};
}

// force on p1 due to the potential
function potForce(p1,p2){
  var rVec = [p2[0]-p1[0],p2[1]-p1[1]];
  var dist = Math.sqrt(rVec[0]*rVec[0] + rVec[1]*rVec[1]);
  return [
    (20/(dist*dist*dist) - 8/(dist*dist*dist*dist*dist)) * rVec[0] / dist,
    (20/(dist*dist*dist) - 8/(dist*dist*dist*dist*dist)) * rVec[1] / dist,
  ];
}

function gravity(){
  return [0, 100*m]
}

// update a position with its current position, velocity and acting forces
function symplecticIntegrate(p,v,f,dt){
  vNew = [
    v[0] + f[0]/m * dt,
    v[1] + f[1]/m * dt
  ];
  pNew = [
    p[0] + vNew[0] * dt,
    p[1] + vNew[1] * dt
  ];
  return {position: pNew, velocity: vNew};
}

function dump(ps, step){
  var fs = require("fs");
  var out = fs.createWriteStream("out/dump_"+step+".vtk");
  out.write("# vtk DataFile Version 3.1\n");
  out.write("waterdroplet.. inspired by Martin Hanke-Bourgeois\n");
  out.write("ASCII\n");
  out.write("DATASET POLYDATA\n");
  out.write("POINTS "+ps.length+" float\n");
  for(var i=0; i<ps.length; i++){
    out.write(ps[i][0].toPrecision(4)+" "+ps[i][1].toPrecision(4)+" 0\n");
  }
  out.end();
}

function initialize(){
  adhesion = initializeTopLine(h,r);
  curState = initializeHalfCircle(h,r);
  curStep = 0;
}
initialize();
function work(){
  var n = curState.positions.length;
  i = curStep;
  if(typeof(module) != "undefined"){
    dump(curState.positions, i);
    console.log("performing step " + (i+1) + " / " + steps);
  }
  forces = [];
  for(var p1 = 0; p1 < n; p1++){
    if(i < noGravSteps){
      forces[p1] = [0,0];
    } else {
      forces[p1] = gravity();
    }
    for(var p2 = 0; p2 < n; p2++){
      if(p1 == p2) continue;
      var fp = potForce(curState.positions[p1], curState.positions[p2]);
      forces[p1] = [forces[p1][0] + fp[0], forces[p1][1] + fp[1]];
    }
    for(var p2 = 0; p2 < adhesion.length; p2++){
      var fp = potForce(curState.positions[p1], adhesion[p2]);
      var factor = 1.75;
      forces[p1] = [forces[p1][0] + factor*fp[0], forces[p1][1] + factor*fp[1]];
    }
  }
  for(var p=0; p<n; p++){
    var next = symplecticIntegrate(
      curState.positions[p], curState.velocities[p],
      forces[p], dt);
    curState.positions[p] = next.position;
    curState.velocities[p] = next.velocity;
  }
  curStep++;
  if(i< steps && typeof(module) != "undefined"){
    setTimeout(work,0);
  }
}

if(typeof(module) != "undefined"){
  process.nextTick(work);
}
