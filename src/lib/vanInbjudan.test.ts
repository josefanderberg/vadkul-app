import { describe, expect, it } from 'vitest';
import { vänInbjudningsUrl } from './vanInbjudan';

describe('vänInbjudningsUrl', () => {
    it('bygger samma ?van-länk som webben', () => {
        expect(vänInbjudningsUrl('aBc123XyZ0aBc123XyZ0aBc123Xy')).toBe('https://vadkul.se/?van=aBc123XyZ0aBc123XyZ0aBc123Xy');
    });
});
