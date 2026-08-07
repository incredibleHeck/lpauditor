import React from "react";

interface ScoreRingProps {
  score: number;
}

export default function ScoreRing({ score }: ScoreRingProps) {
  let scoreStroke = "stroke-red-500";
  if (score >= 80) {
    scoreStroke = "stroke-emerald-500";
  } else if (score >= 50) {
    scoreStroke = "stroke-amber-500";
  }

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="56" cy="56" r={radius} className="stroke-zinc-100" strokeWidth="10" fill="transparent" />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`${scoreStroke} transition-all duration-1000 ease-out`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-zinc-900">{score}%</span>
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cambridge</span>
        </div>
      </div>
    </div>
  );
}
