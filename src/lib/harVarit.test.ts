import { describe, expect, it } from 'vitest';
import { eventPastAt, isEventPast, shouldAutoBumpDay, todayIsSpent } from './harVarit';

const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m).getTime();
const ev = (h: number, hasSpecificTime = true) => ({
    time: new Date(2026, 8, 29, h, 0).toISOString(),
    hasSpecificTime,
});

describe('isEventPast', () => {
    it('event med klockslag slocknar en timme efter start', () => {
        expect(isEventPast(ev(18), at(18, 59))).toBe(false);
        expect(isEventPast(ev(18), at(19, 0))).toBe(true);
    });
    it('event utan klockslag slocknar kl 20 sin dag', () => {
        expect(isEventPast(ev(0, false), at(19, 59))).toBe(false);
        expect(isEventPast(ev(0, false), at(20, 0))).toBe(true);
    });
    it('ogiltig tid passerar aldrig', () => {
        expect(eventPastAt({ time: 'nej', hasSpecificTime: true })).toBeNull();
        expect(isEventPast({ time: 'nej', hasSpecificTime: true }, at(23))).toBe(false);
    });
});

describe('auto-hoppet till Imorgon', () => {
    it('allt har varit → idag är slut', () => {
        expect(todayIsSpent([ev(10), ev(12)], at(15))).toBe(true);
    });
    it('något kvar dagtid → stanna', () => {
        expect(todayIsSpent([ev(10), ev(16)], at(15))).toBe(false);
    });
    it('tom dag räknas som slut först på kvällen', () => {
        expect(todayIsSpent([], at(12))).toBe(false);
        expect(todayIsSpent([], at(17))).toBe(true);
    });
    it('på kvällen räcker inte heldagsposter som skäl att stanna', () => {
        expect(todayIsSpent([ev(0, false)], at(18))).toBe(true);
        expect(todayIsSpent([ev(0, false), ev(19)], at(18))).toBe(false);
    });
    it('hoppar bara om imorgon har något', () => {
        expect(shouldAutoBumpDay([ev(10)], [ev(10)], at(15))).toBe(true);
        expect(shouldAutoBumpDay([ev(10)], [], at(15))).toBe(false);
    });
});
