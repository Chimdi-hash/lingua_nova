'use client';
import { useEffect, useRef } from 'react';

// Simplified but recognisable continent outlines [lon, lat]
const CONTINENTS: { name: string; color: string; strokeColor: string; coords: [number, number][] }[] = [
  {
    name: 'North America',
    color: 'rgba(129,140,248,0.28)',
    strokeColor: 'rgba(165,180,252,0.75)',
    coords: [
      [-168,71],[-141,60],[-130,55],[-124,50],[-124,37],[-117,32],[-106,22],
      [-92,16],[-83,10],[-77,8],[-77,25],[-80,25],[-82,30],[-90,29],
      [-97,26],[-97,30],[-85,30],[-82,42],[-80,43],[-76,44],[-65,44],
      [-66,47],[-60,47],[-64,58],[-68,63],[-77,63],[-86,68],[-95,74],
      [-110,74],[-124,69],[-140,69],[-165,68],[-168,71],
    ],
  },
  {
    name: 'Greenland',
    color: 'rgba(129,140,248,0.18)',
    strokeColor: 'rgba(165,180,252,0.5)',
    coords: [
      [-44,83],[-25,83],[-18,77],[-18,73],[-25,68],[-35,65],[-44,60],
      [-52,65],[-55,70],[-52,75],[-44,78],[-44,83],
    ],
  },
  {
    name: 'South America',
    color: 'rgba(168,85,247,0.28)',
    strokeColor: 'rgba(192,132,252,0.75)',
    coords: [
      [-73,12],[-63,11],[-60,5],[-50,2],[-36,-5],[-35,-10],[-38,-14],
      [-40,-20],[-43,-23],[-47,-28],[-50,-33],[-55,-35],[-58,-38],
      [-62,-42],[-65,-55],[-68,-54],[-72,-50],[-70,-45],[-65,-40],
      [-64,-33],[-64,-26],[-68,-22],[-70,-18],[-76,-10],[-78,0],
      [-78,8],[-73,12],
    ],
  },
  {
    name: 'Europe',
    color: 'rgba(34,211,238,0.22)',
    strokeColor: 'rgba(103,232,249,0.70)',
    coords: [
      [-9,37],[0,37],[8,36],[15,37],[23,37],[28,41],[33,41],[32,42],
      [40,42],[38,47],[28,46],[22,48],[20,54],[24,58],[22,60],[27,66],
      [20,70],[14,68],[5,62],[-2,57],[-5,48],[-9,44],[-9,37],
    ],
  },
  {
    name: 'Africa',
    color: 'rgba(129,140,248,0.26)',
    strokeColor: 'rgba(165,180,252,0.72)',
    coords: [
      [-17,15],[-16,20],[-13,27],[-5,35],[10,37],[20,37],[30,30],
      [36,22],[40,15],[44,11],[42,1],[40,-5],[35,-17],[33,-28],
      [27,-34],[20,-35],[15,-30],[10,-22],[7,-5],[2,5],[0,8],
      [5,15],[0,17],[-5,16],[-17,15],
    ],
  },
  {
    name: 'Asia',
    color: 'rgba(192,132,252,0.26)',
    strokeColor: 'rgba(216,180,254,0.72)',
    coords: [
      [26,42],[33,37],[40,38],[48,30],[56,23],[57,14],[46,8],[50,8],
      [58,22],[66,23],[72,20],[76,8],[80,9],[100,5],[104,1],[110,1],
      [120,20],[121,26],[123,38],[130,36],[132,43],[140,42],[142,47],
      [140,54],[136,55],[130,60],[120,65],[110,65],[96,68],[80,68],
      [70,68],[60,68],[55,63],[58,55],[52,52],[46,48],[40,44],[30,45],[26,42],
    ],
  },
  {
    name: 'Australia',
    color: 'rgba(34,211,238,0.22)',
    strokeColor: 'rgba(103,232,249,0.65)',
    coords: [
      [114,-22],[116,-20],[120,-18],[125,-14],[130,-12],[136,-12],
      [140,-15],[145,-15],[148,-20],[150,-24],[152,-27],[154,-28],
      [152,-33],[150,-38],[144,-38],[140,-36],[135,-35],[130,-33],
      [124,-34],[118,-34],[114,-30],[113,-26],[114,-22],
    ],
  },
  {
    name: 'Antarctica',
    color: 'rgba(129,140,248,0.14)',
    strokeColor: 'rgba(165,180,252,0.40)',
    coords: [
      [-180,-72],[-120,-72],[-60,-72],[0,-72],[60,-72],[120,-72],[180,-72],
      [180,-90],[-180,-90],[-180,-72],
    ],
  },
];

const toRad = (d: number) => (d * Math.PI) / 180;

// Orthographic projection — returns [x, y, z] where z>0 is front hemisphere
const project = (lon: number, lat: number, rotY: number, rotX: number): [number, number, number] => {
  const lambda = toRad(lon) - rotY;
  const phi = toRad(lat);
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi) * Math.cos(rotX) - Math.cos(phi) * Math.cos(lambda) * Math.sin(rotX);
  const z = Math.sin(phi) * Math.sin(rotX) + Math.cos(phi) * Math.cos(lambda) * Math.cos(rotX);
  return [x, y, z];
};

export default function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 420;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const R = SIZE / 2 - 4;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const TILT = toRad(20); // earth axial tilt feel

    let rotY = 0;
    let floatT = 0;
    let raf: number;

    const mapToCanvas = (nx: number, ny: number) => [CX + nx * R, CY - ny * R] as [number, number];

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Outer glow
      const glow = ctx.createRadialGradient(CX, CY, R * 0.6, CX, CY, R * 1.5);
      glow.addColorStop(0, 'rgba(79,70,229,0.10)');
      glow.addColorStop(1, 'rgba(79,70,229,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, R * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Ocean sphere
      const ocean = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
      ocean.addColorStop(0, 'rgba(129,140,248,0.14)');
      ocean.addColorStop(0.5, 'rgba(79,70,229,0.07)');
      ocean.addColorStop(1, 'rgba(8,12,20,0.05)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = ocean;
      ctx.fill();
      ctx.strokeStyle = 'rgba(129,140,248,0.30)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.clip(); // clip all drawing to globe circle

      // Latitude grid lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 2) {
          const [nx, ny, z] = project(lon, lat, rotY, TILT);
          if (z < 0) { started = false; continue; }
          const [cx, cy] = mapToCanvas(nx, ny);
          if (!started) { ctx.moveTo(cx, cy); started = true; } else ctx.lineTo(cx, cy);
        }
        ctx.strokeStyle = lat === 0 ? 'rgba(34,211,238,0.18)' : 'rgba(129,140,248,0.10)';
        ctx.lineWidth = lat === 0 ? 0.8 : 0.4;
        ctx.stroke();
      }

      // Longitude grid lines
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 2) {
          const [nx, ny, z] = project(lon, lat, rotY, TILT);
          if (z < 0) { started = false; continue; }
          const [cx, cy] = mapToCanvas(nx, ny);
          if (!started) { ctx.moveTo(cx, cy); started = true; } else ctx.lineTo(cx, cy);
        }
        ctx.strokeStyle = 'rgba(129,140,248,0.07)';
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Draw continents
      CONTINENTS.forEach(({ coords, color, strokeColor }) => {
        // Collect visible segments
        const visible: [number, number][] = [];
        coords.forEach(([lon, lat]) => {
          const [nx, ny, z] = project(lon, lat, rotY, TILT);
          if (z >= 0) visible.push(mapToCanvas(nx, ny));
        });

        if (visible.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(visible[0][0], visible[0][1]);
        visible.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Specular highlight (light glint top-left)
      const specular = ctx.createRadialGradient(CX - R * 0.5, CY - R * 0.5, 0, CX - R * 0.3, CY - R * 0.3, R * 0.6);
      specular.addColorStop(0, 'rgba(255,255,255,0.06)');
      specular.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fillStyle = specular;
      ctx.fill();

      ctx.restore();

      rotY += 0.005;     // slow steady rotation
      floatT += 0.018;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        opacity: 0.75,
        filter: 'drop-shadow(0 0 40px rgba(79,70,229,0.35))',
      }}
    />
  );
}
