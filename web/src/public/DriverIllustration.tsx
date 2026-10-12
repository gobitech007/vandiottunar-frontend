/** Hero illustration: a uniformed professional driver at the wheel, seen through the windscreen. */
export default function DriverIllustration({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 520 460" role="img" aria-label={label} className="hero-art">
      <defs>
        <clipPath id="vo-glass">
          <path d="M70 70 Q260 30 450 70 L486 330 Q260 300 34 330 Z" />
        </clipPath>
        <linearGradient id="vo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF4CF" />
          <stop offset="1" stopColor="#F7E3A1" />
        </linearGradient>
      </defs>

      {/* Background disc */}
      <circle cx="260" cy="240" r="215" fill="#F2B705" opacity="0.18" />

      {/* Car body / windscreen frame */}
      <path d="M58 64 Q260 18 462 64 L506 344 Q260 312 14 344 Z" fill="#0E3B2E" />
      <path d="M70 70 Q260 30 450 70 L486 330 Q260 300 34 330 Z" fill="url(#vo-sky)" />

      <g clipPath="url(#vo-glass)">
        {/* Seat back */}
        <path d="M150 150 Q260 112 370 150 L388 340 L132 340 Z" fill="#1B5443" />
        <path d="M168 160 Q260 128 352 160 L362 340 L158 340 Z" fill="#245F4C" />

        {/* Shoulders and shirt (white uniform) */}
        <path d="M158 340 Q164 262 214 246 L306 246 Q356 262 362 340 Z" fill="#FFFFFF" />
        <path d="M214 246 L260 300 L306 246" fill="none" stroke="#E3DCC8" strokeWidth="3" />
        {/* Collar */}
        <path d="M222 240 L260 278 L244 296 L210 254 Z" fill="#F4F1EA" stroke="#E3DCC8" strokeWidth="2" />
        <path d="M298 240 L260 278 L276 296 L310 254 Z" fill="#F4F1EA" stroke="#E3DCC8" strokeWidth="2" />
        {/* Tie */}
        <path d="M252 276 L268 276 L272 290 L264 340 L256 340 L248 290 Z" fill="#0E3B2E" />
        {/* Epaulettes */}
        <rect x="176" y="258" width="40" height="10" rx="4" fill="#0E3B2E" transform="rotate(-14 196 263)" />
        <rect x="304" y="258" width="40" height="10" rx="4" fill="#0E3B2E" transform="rotate(14 324 263)" />
        {/* Badge */}
        <rect x="286" y="300" width="30" height="20" rx="4" fill="#F2B705" />
        <circle cx="301" cy="310" r="5" fill="none" stroke="#0E3B2E" strokeWidth="2" />

        {/* Neck */}
        <path d="M244 214 L276 214 L278 250 L242 250 Z" fill="#B87C4C" />
        {/* Head */}
        <ellipse cx="260" cy="186" rx="46" ry="54" fill="#C68B59" />
        {/* Ears */}
        <ellipse cx="214" cy="190" rx="8" ry="13" fill="#B87C4C" />
        <ellipse cx="306" cy="190" rx="8" ry="13" fill="#B87C4C" />
        {/* Hair */}
        <path d="M214 176 Q212 128 260 126 Q308 128 306 176 Q300 150 282 146 Q262 158 238 148 Q220 154 214 176 Z" fill="#1E1A17" />
        {/* Chauffeur cap */}
        <path d="M206 150 Q260 104 314 150 L310 160 Q260 142 210 160 Z" fill="#0E3B2E" />
        <path d="M204 156 Q260 138 316 156 L318 168 Q260 152 202 168 Z" fill="#082A20" />
        <rect x="248" y="128" width="24" height="10" rx="3" fill="#F2B705" />
        {/* Eyes, brows, smile, moustache */}
        <ellipse cx="243" cy="190" rx="4.5" ry="5" fill="#1E1A17" />
        <ellipse cx="277" cy="190" rx="4.5" ry="5" fill="#1E1A17" />
        <path d="M233 178 Q243 173 252 178" stroke="#1E1A17" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M268 178 Q277 173 287 178" stroke="#1E1A17" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M256 196 Q260 206 264 196" stroke="#A86F43" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M242 214 Q260 206 278 214 Q270 220 260 216 Q250 220 242 214 Z" fill="#1E1A17" />
        <path d="M246 222 Q260 232 274 222" stroke="#7A3E2A" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Arms reaching to the wheel */}
        <path d="M168 300 Q150 330 168 352 L200 342 Q190 322 206 300 Z" fill="#FFFFFF" />
        <path d="M352 300 Q370 330 352 352 L320 342 Q330 322 314 300 Z" fill="#FFFFFF" />
      </g>

      {/* Dashboard */}
      <path d="M0 360 Q260 318 520 360 L520 460 L0 460 Z" fill="#0E3B2E" />
      <path d="M40 372 Q260 340 480 372" stroke="#1B5443" strokeWidth="6" fill="none" />

      {/* Steering wheel */}
      <g>
        <circle cx="260" cy="380" r="104" fill="none" stroke="#0A2A20" strokeWidth="22" />
        <circle cx="260" cy="380" r="104" fill="none" stroke="#2B6B55" strokeWidth="4" opacity="0.6" />
        <path d="M168 372 Q260 352 352 372" stroke="#0A2A20" strokeWidth="18" fill="none" strokeLinecap="round" />
        <rect x="248" y="372" width="24" height="70" rx="8" fill="#0A2A20" />
        <circle cx="260" cy="378" r="30" fill="#0A2A20" />
        <circle cx="260" cy="378" r="14" fill="#F2B705" />
      </g>

      {/* Hands on the wheel at ten and two */}
      <g>
        <ellipse cx="180" cy="322" rx="22" ry="17" fill="#C68B59" transform="rotate(-35 180 322)" />
        <path d="M168 310 Q182 302 194 312" stroke="#A86F43" strokeWidth="2.5" fill="none" />
        <ellipse cx="340" cy="322" rx="22" ry="17" fill="#C68B59" transform="rotate(35 340 322)" />
        <path d="M352 310 Q338 302 326 312" stroke="#A86F43" strokeWidth="2.5" fill="none" />
        {/* Shirt cuffs */}
        <rect x="174" y="336" width="34" height="12" rx="4" fill="#FFFFFF" transform="rotate(-35 191 342)" />
        <rect x="312" y="336" width="34" height="12" rx="4" fill="#FFFFFF" transform="rotate(35 329 342)" />
      </g>

      {/* Verified badge */}
      <g transform="translate(400 110)">
        <circle r="40" fill="#FFFFFF" stroke="#1F7A4D" strokeWidth="5" />
        <path d="M-17 1 L-5 13 L18 -12" stroke="#1F7A4D" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
