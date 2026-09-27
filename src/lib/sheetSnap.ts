/**
 * Arkstoppen för eventkortet - ETT stopp per gest, samma princip som webbens
 * utils/sheetSnap: en svepning uppåt fäller ut, en nedåt går till peek, och
 * från peek stänger den. Ren logik utan gester så den kan testas i vitest.
 *
 * offset är arkets translateY: 0 = utfällt, peekOffset = peek-läget,
 * större = på väg ner mot stängt.
 */
export type SheetLäge = 'utfällt' | 'peek' | 'stängt';

/** px/ms - snabbare svep än så avgör riktningen ensam. */
const SNABB = 0.6;

export function nästaLäge(
    start: 'utfällt' | 'peek',
    offset: number,
    velocity: number,
    peekOffset: number,
    stängTröskel = 80,
): SheetLäge {
    if (velocity <= -SNABB) return 'utfällt';
    if (velocity >= SNABB) return start === 'utfällt' ? 'peek' : 'stängt';
    if (offset > peekOffset + stängTröskel) return 'stängt';
    return offset < peekOffset / 2 ? 'utfällt' : 'peek';
}
