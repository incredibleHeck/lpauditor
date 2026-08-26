import React from "react";

interface ScoreRingProps {
  score: number;
}

export default function ScoreRing({ score }: ScoreRingProps) {
  let scoreStroke = "stroke-rose-600";
  if (score >= 80) {
    scoreStroke = "stroke-emerald-600";
  } else if (score >= 50) {
    scoreStroke = "stroke-amber-500";
  }

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center text-center font-sans">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle 
            cx="56" 
            cy="56" 
            r={radius} 
            className="stroke-slate-100" 
            strokeWidth="8" 
            fill="transparent" 
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`${scoreStroke} transition-all duration-1000 ease-out`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{score}%</span>
          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Cambridge</span>
        </div>
      </div>
    </div>
  );
}
