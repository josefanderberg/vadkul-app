// GENERERAD av scripts/baka-moln.mjs - redigera inte för hand.
/** Molnbildens mått i px (webbens SPRITE_W x SPRITE_H). */
export const MOLN_BILD = { bredd: 256, höjd: 168 } as const;
/**
 * Formerna i webbens ordning, utan speglingarna. `uppifrån` = sedd uppifrån
 * (bara de växer fortare än kartan vid zoom), `ankareY` = var i bilden
 * molnet har sin mitt, som andel av höjden.
 */
export const MOLN_FORMER: readonly { uppifrån: boolean; ankareY: number }[] = [
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: false, ankareY: 0.58 },
    { uppifrån: true, ankareY: 0.5 },
    { uppifrån: true, ankareY: 0.5 },
];
