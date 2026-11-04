/**
 * De aktiva boostarna som React-state - varje yta som visar stjärnan
 * (kartan, eventkortet, listorna) kallar hooken; lyssnaren i data/boostar
 * delas ändå (refräknad singleton). Egna boostade event bär featuredUntil
 * själva - kartan bor i lib/boost (ärBoostad) som slår ihop båda vägarna.
 */
import { useEffect, useState } from 'react';
import { prenumereraBoostar } from '@/data/boostar';
import { INGA_BOOSTAR, type Boostar } from './boost';

export function useBoostar(): Boostar {
    const [boostar, setBoostar] = useState<Boostar>(INGA_BOOSTAR);
    useEffect(() => prenumereraBoostar(setBoostar), []);
    return boostar;
}
