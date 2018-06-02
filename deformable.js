
if(typeof(module) != "undefined"){
  var _ = require('lodash');
}

var dt = 0.0005;
var steps = 1000;
defStiffness = 1000;
var floor_k = 1000;
var damping = 0.9999;

function add2DVector(v1,v2){
  var ret = [0,0];
  ret[0] = v1[0] + v2[0];
  ret[1] = v1[1] + v2[1];
  return ret;
}

function addAcceleration(particle, acc){
  var m = particle.mass;
  return addForce(particle, [acc[0] * m, acc[1] * m]);
}

function addForce(particle, force){
  var newParticle = _.clone(particle);
  newParticle.force = add2DVector(particle.force, force);
  return newParticle;
}

function gravity(particle){
  return addAcceleration(particle, [0,-9.8]);
}

function springy_floor(k){
  return function (particle){
    if(particle.pos[1] < 0){
      return addForce(particle, [0, -k*particle.pos[1]]);
    }
    return particle;
  }
}

var floor = springy_floor(floor_k);

function linkForce(p1,p2,d,k){
  var rVec = [p2[0]-p1[0],p2[1]-p1[1]];
  var dist = Math.sqrt(rVec[0]*rVec[0] + rVec[1]*rVec[1]);
  var factor = k * ((dist - d)+(dist - d)*(dist - d)*(dist - d)/d/d/d) / dist;
  return [factor * rVec[0],factor*rVec[1]];
}

function links(particles){
  return function(particle){
    var force = _.reduce(particle.links, function(force,link){
      return add2DVector(force,linkForce(particle.pos, particles[link.neighbor].pos,
        link.d, link.k));
    },[0,0]);
    return addForce(particle, force);
  }
}

function symplecticIntegrator(dt){
  return function integrate(particle){
    var nP = _.clone(particle)
    var m = particle.mass;
    nP.v = [
      damping*particle.v[0] + particle.force[0]/m * dt,
      damping*particle.v[1] + particle.force[1]/m * dt
    ];
    nP.pos = [
      nP.pos[0] + nP.v[0] * dt,
      nP.pos[1] + nP.v[1] * dt
    ];
    nP.force = [0,0];
    return nP;
  }
}

var integrate = symplecticIntegrator(dt);

function simulateDeformable(deformable){
  var particles = deformable.particles;
  var linkFunction = links(particles);
  var newParticles = _(particles).chain()
    .map(gravity)
    .map(floor)
    .map(linkFunction)
    .map(integrate)
    .value();

  return {particles: newParticles};
}

function linksFor(x,y,w,h,k,border){
  var neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1],
     [x-1,y-1],[x-1,y+1],[x+1,y-1],[x+1,y+1]];
  return _(neighbors).chain()
     .select(function(l){ return l[0] >= 0 && l[1] >= 0 })
     .select(function(l){ return l[0] < w && l[1] < w })
     .uniq()
     .map(function(l){
       var dist = Math.sqrt(Math.pow(l[0] - x,2) + Math.pow(l[1] - y,2));
       return {neighbor: l[0]+w*l[1], k:k, d:dist*h};
     })
     .value();
}

// creates a square deformable matching the given definition
// a defition contains the dimensions, mass, stiffness, spacing and center
function createSquareDeformable(def){
  var ps = [];
  var p = def.center;
  var a = def.dimensions;
  var h = def.spacing;
  var k = def.stiffness;
  var border = [];
  var p_per_line = Math.floor(a/h);
  for(var y=0; y<p_per_line; y++){
    border.push([0,y]);
    border.push([p_per_line-1,y]);
  }
  for(var x=0; x<p_per_line; x++){
    border.push([x,0]);
    border.push([x,p_per_line-1]);
  }
  var particles = p_per_line * p_per_line;
  for(var y=0; y<p_per_line; y++){
    for(var x=0; x<p_per_line; x++){
      ps.push({
        pos: [x*h + p[0], y*h + p[1]],
        v: [0,0],
        mass: def.mass / particles, // distribute mass of whole box evenly to particles
        force: [0,0],
        links: linksFor(x,y,p_per_line,h,k,border)
      });
    }
  }
  if(particles != ps.length){
    console.log("calculated particle number does not match real particle number");
    console.log("#calc_part: " + particles);
    console.log("#part: " + ps.length);
    console.log("dimensions: " + a);
    console.log("spacing: " + h);
    console.log("#parts_per_line: " + p_per_line);
  }
  return  { particles: ps };
}

var defObj = null;
function initialize(){
  defObj = createSquareDeformable({
    dimensions: 3,
    mass: 5,
    stiffness: defStiffness,
    spacing: 0.1,
    center: [0,10]
  });
}
initialize();

// if you run this on console you get a vtk file
function dump(ps, step){
  var fs = require("fs");
  var out = fs.createWriteStream("def_out/dump_"+step+".vtk");
  out.write("# vtk DataFile Version 3.1\n");
  out.write("waterdroplet.. inspired by Martin Hanke-Bourgeois\n");
  out.write("ASCII\n");
  out.write("DATASET POLYDATA\n");
  out.write("POINTS "+ps.length+" float\n");
  for(var i=0; i<ps.length; i++){
    out.write(ps[i].pos[0].toPrecision(4)+" "+ps[i].pos[1].toPrecision(4)+" 0\n");
  }
  out.end();
}

console.log("deformable object has " + defObj.particles.length + " particles");
var curStep = 0;
function work(){
  var i = curStep;
  if(typeof(module) != "undefined"){
    dump(defObj.particles, i);
    console.log("performing step " + (i+1) + " / " + steps);
  }
  defObj = simulateDeformable(defObj);
  curStep++;
  if(i<steps && typeof(module) != "undefined"){
    setTimeout(work,0);
  }
}

if(typeof(module) != "undefined"){
  process.nextTick(work);
}
