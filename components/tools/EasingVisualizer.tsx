/// <reference lib="dom" />
import React, { useRef, useEffect, useState } from 'react';

// --- Math Formulas ---

const c4 = (2 * Math.PI) / 3;

// Helper to create OutIn from In and Out functions
// OutIn: The first half is the Out function, the second half is the In function.
const makeOutIn = (inFn: (t: number) => number, outFn: (t: number) => number) => (t: number) => {
  if (t < 0.5) {
    return outFn(t * 2) / 2;
  }
  return inFn(t * 2 - 1) / 2 + 0.5;
};

// --- Basics ---
const linear = (t: number) => t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const constant = (t: number) => 0;

// --- Standard Families ---
const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);
const sineInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

const quadIn = (t: number) => t * t;
const quadOut = (t: number) => 1 - (1 - t) * (1 - t);
const quadInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const cubicIn = (t: number) => t * t * t;
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
const cubicInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const quartIn = (t: number) => t * t * t * t;
const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);
const quartInOut = (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

const quintIn = (t: number) => t * t * t * t * t;
const quintOut = (t: number) => 1 - Math.pow(1 - t, 5);
const quintInOut = (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

const expoIn = (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
const expoOut = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const expoInOut = (t: number) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if ((t /= 0.5) < 1) return Math.pow(2, 10 * (t - 1)) / 2;
  return (2 - Math.pow(2, -10 * (t - 1))) / 2;
};

const circIn = (t: number) => 1 - Math.sqrt(1 - Math.pow(t, 2));
const circOut = (t: number) => Math.sqrt(1 - Math.pow(t - 1, 2));
const circInOut = (t: number) => t < 0.5
  ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
  : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

const backIn = (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; };
const backOut = (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const backInOut = (t: number) => {
  const c1 = 1.70158; const c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

const elasticIn = (t: number) => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
const elasticOut = (t: number) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
const elasticInOut = (t: number) => {
  const c5 = (2 * Math.PI) / 4.5;
  return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
};

function bounceOut(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
}
const bounceIn = (t: number) => 1 - bounceOut(1 - t);
const bounceInOut = (t: number) => t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;


// Define Groups with flexible items
const easingGroups = [
  {
    id: 'basics',
    name: 'Basics',
    items: [
        { title: 'linear', fn: linear },
        { title: 'smooth', fn: smooth },
        { title: 'fade', fn: fade },
        { title: 'constant', fn: constant },
    ]
  },
  {
    id: 'quad',
    name: 'Quad',
    items: [
        { title: 'quadIn', fn: quadIn },
        { title: 'quadOut', fn: quadOut },
        { title: 'quadInOut', fn: quadInOut },
        { title: 'quadOutIn', fn: makeOutIn(quadIn, quadOut) },
    ]
  },
  {
    id: 'cubic',
    name: 'Cubic',
    items: [
        { title: 'cubicIn', fn: cubicIn },
        { title: 'cubicOut', fn: cubicOut },
        { title: 'cubicInOut', fn: cubicInOut },
        { title: 'cubicOutIn', fn: makeOutIn(cubicIn, cubicOut) },
    ]
  },
  {
    id: 'quart',
    name: 'Quart',
    items: [
        { title: 'quartIn', fn: quartIn },
        { title: 'quartOut', fn: quartOut },
        { title: 'quartInOut', fn: quartInOut },
        { title: 'quartOutIn', fn: makeOutIn(quartIn, quartOut) },
    ]
  },
  {
    id: 'quint',
    name: 'Quint',
    items: [
        { title: 'quintIn', fn: quintIn },
        { title: 'quintOut', fn: quintOut },
        { title: 'quintInOut', fn: quintInOut },
        { title: 'quintOutIn', fn: makeOutIn(quintIn, quintOut) },
    ]
  },
  {
    id: 'sine',
    name: 'Sine',
    items: [
        { title: 'sineIn', fn: sineIn },
        { title: 'sineOut', fn: sineOut },
        { title: 'sineInOut', fn: sineInOut },
        { title: 'sineOutIn', fn: makeOutIn(sineIn, sineOut) },
    ]
  },
  {
    id: 'expo',
    name: 'Expo',
    items: [
        { title: 'expoIn', fn: expoIn },
        { title: 'expoOut', fn: expoOut },
        { title: 'expoInOut', fn: expoInOut },
        { title: 'expoOutIn', fn: makeOutIn(expoIn, expoOut) },
    ]
  },
  {
    id: 'circ',
    name: 'Circ',
    items: [
        { title: 'circIn', fn: circIn },
        { title: 'circOut', fn: circOut },
        { title: 'circInOut', fn: circInOut },
        { title: 'circOutIn', fn: makeOutIn(circIn, circOut) },
    ]
  },
  {
    id: 'elastic',
    name: 'Elastic',
    items: [
        { title: 'elasticIn', fn: elasticIn },
        { title: 'elasticOut', fn: elasticOut },
        { title: 'elasticInOut', fn: elasticInOut },
        { title: 'elasticOutIn', fn: makeOutIn(elasticIn, elasticOut) },
    ]
  },
  {
    id: 'back',
    name: 'Back',
    items: [
        { title: 'backIn', fn: backIn },
        { title: 'backOut', fn: backOut },
        { title: 'backInOut', fn: backInOut },
        { title: 'backOutIn', fn: makeOutIn(backIn, backOut) },
    ]
  },
  {
    id: 'bounce',
    name: 'Bounce',
    items: [
        { title: 'bounceIn', fn: bounceIn },
        { title: 'bounceOut', fn: bounceOut },
        { title: 'bounceInOut', fn: bounceInOut },
        { title: 'bounceOutIn', fn: makeOutIn(bounceIn, bounceOut) },
    ]
  }
];

const EasingCard: React.FC<{ title: string, fn: (t: number) => number }> = ({ title, fn }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const ballRef = useRef<HTMLDivElement>(null);
  
  // Draw function extracted to be called inside requestAnimationFrame
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Check if rect is valid (non-zero), otherwise skip (might be hidden or not laid out)
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    
    // Adjusted padding to allow overshoot for Elastic/Back functions
    const paddingX = 8;
    const paddingY = 40; 
    
    const graphW = w - paddingX * 2;
    const graphH = h - paddingY * 2;

    // Clear
    ctx.clearRect(0, 0, w, h);
    
    // Draw Axis (Light grid)
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    const y0 = paddingY + graphH; // Bottom line (value 0)
    const y1 = paddingY;          // Top line (value 1)
    
    ctx.beginPath(); ctx.moveTo(paddingX, y1); ctx.lineTo(w - paddingX, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(paddingX, y0); ctx.lineTo(w - paddingX, y0); ctx.stroke();
    
    // Draw Curve
    ctx.strokeStyle = '#2a97ff'; // Primary 500
    ctx.lineWidth = 3; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    for (let x = 0; x <= graphW; x++) {
      const t = x / graphW;
      const val = fn(t);
      const y = (1 - val) * graphH; 
      
      const drawX = paddingX + x;
      const drawY = paddingY + y;

      if (x === 0) ctx.moveTo(drawX, drawY);
      else ctx.lineTo(drawX, drawY);
    }
    ctx.stroke();
  };

  // Draw the static curve
  useEffect(() => {
    // Use requestAnimationFrame to wait for any layout shifts or fade-in animations to settle
    // before reading getBoundingClientRect inside draw()
    const rafId = requestAnimationFrame(() => {
       draw();
    });
    return () => cancelAnimationFrame(rafId);
  }, [fn]);

  // Handle Animation on Hover
  useEffect(() => {
    if (isHovered) {
      startTimeRef.current = performance.now();
      const duration = 1200; // ms

      const animate = (time: number) => {
        const elapsed = time - startTimeRef.current;
        let t = elapsed / duration;

        if (t > 1) {
            if (t > 1.3) { // 300ms pause
                startTimeRef.current = performance.now();
                t = 0;
            } else {
                t = 1;
            }
        }

        // Apply easing
        const easedT = fn(Math.min(1, Math.max(0, t)));
        
        if (ballRef.current) {
             ballRef.current.style.bottom = `${easedT * 92}%`; 
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      if (ballRef.current) ballRef.current.style.bottom = `0%`;
    }

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isHovered, fn]);

  return (
    <div 
      className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group flex items-center gap-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-700 mb-1 font-mono tracking-tight">{title}</div>
        <div className="h-48 w-full relative">
             <canvas 
                ref={canvasRef} 
                className="w-full h-full block"
             />
        </div>
      </div>
      
      {/* Vertical Animation Track */}
      <div className="h-48 w-3 bg-gray-100 rounded-full relative shrink-0">
        <div 
            ref={ballRef}
            className="absolute bottom-0 left-0.5 w-2 h-2 bg-primary-600 rounded-full shadow-sm"
            style={{ transition: 'none' }} 
        />
      </div>
    </div>
  );
};

const EasingVisualizer: React.FC = () => {
  return (
    <div className="space-y-10 animate-fade-in pb-10 w-full">
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
        <p>
            展示了常见的缓动函数曲线。鼠标悬停在卡片上，右侧的垂直进度条将演示该缓动效果的速度变化。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {easingGroups.map((group) => (
            <div key={group.id} className="space-y-4">
                <div className="border-b border-gray-100 pb-2">
                    <h3 className="text-xl font-bold text-gray-800">{group.name}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.items.map((item) => (
                        <EasingCard key={item.title} title={item.title} fn={item.fn} />
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default EasingVisualizer;