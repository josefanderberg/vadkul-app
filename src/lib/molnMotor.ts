/**
 * Molnlagrets motor (josefanderberg/VADKUL#233): takten och kopplingen mot
 * kartan från webbens apps/web/src/components/v2/v2MapClouds.ts
 * (attachEventClouds) - när molnen byggs om, när en bildruta ritas och när
 * slingan får vila. Själva bildrutan räknas i lib/moln, bilderna läggs ut av
 * components/KartMoln.
 *
 * Mjukheten kommer av samma tre saker som på webben:
 *  1. Under en kartrörelse följer molnen kartans egna rörelsehändelser
 *     (webbens 'render'), inte en egen takt bredvid. Webben ritar om hela
 *     canvasen i varje sådan bildruta; här flyttas och skalas hela lagret
 *     som EN vy (lib/moln behållareFör), och molnen läggs ut på nytt bara i
 *     vilotakt, när något animeras eller när kartan flyttat sig förbi
 *     lagrets kant. Varje bildruta av en panorering kostar då en enda vy.
 *  2. Ingenting hoppar: knuffen är en glidning som bromsas in, moln och
 *     uppsättningar tonar över.
 *  3. I vila driver molnen bara några pt och ritas glest (VILO_RAM_MS), så
 *     lagret inte kostar batteri. Inzoomat förbi molnens gräns, när skärmen
 *     inte visas eller appen ligger i bakgrunden står slingan helt still.
 *
 * Pekskärmens regler från webben: ett TRYCK skingrar molnen där (webbens
 * setTouchPoint) tills kartan zoomas - en zoomning knuffar aldrig (#210), så
 * den avväpnar trycket tills nästa tryck. Det valda eventet knuffar alltid.
 * Muspekarens knuff finns inte här: en telefon har ingen hovring.
 *
 * Ren modul (klockan går att byta ut), så takten går att testa.
 */
import { cloudOpacityForZoom, type CloudPoint } from '@vadkul/kontrakt';
import {
    behållareFör,
    bildruta,
    byggOm,
    BYGG_OM_MS,
    fördela,
    läggIVyer,
    nyaPlatser,
    nyVärld,
    sammaPlan,
    tommaVyer,
    VILO_RAM_MS,
    VY_RAND_PT,
    type MolnKamera,
    type MolnPlatser,
    type MolnRam,
    type MolnVärld,
    type VyData,
} from './moln';

/** Kartans vy som den native kartan rapporterar den (MapLibres ViewState). */
export interface MolnVy {
    center: readonly number[];
    zoom: number;
    bearing: number;
    pitch: number;
}

/**
 * Det lagret ska visa: hela lagrets flytt och skala (följer kartan i varje
 * bildruta) och bildvyerna i lagrets egna koordinater. Listorna behåller sin
 * identitet tills någon vy ändrats, och en oförändrad vy sitt objekt.
 */
export interface MolnBild {
    tx: number;
    ty: number;
    skala: number;
    moln: readonly VyData[];
    skuggor: readonly VyData[];
}

/** Lagret innan motorn ritat något: alla vyer dolda. */
export function tomBild(behov: { moln: number; skuggor: number }): MolnBild {
    return { tx: 0, ty: 0, skala: 1, moln: tommaVyer(behov.moln), skuggor: tommaVyer(behov.skuggor) };
}

export interface MotorUt {
    /** Visa bilden. Anropas bara när något ändrats. */
    visa(bild: MolnBild): void;
}

export interface MotorKlocka {
    nu(): number;
    nästaBildruta(fn: (nu: number) => void): unknown;
    avbrytBildruta(handtag: unknown): void;
    senare(fn: () => void, ms: number): unknown;
    avbrytSenare(handtag: unknown): void;
}

const SYSTEMKLOCKA: MotorKlocka = {
    nu: () => performance.now(),
    nästaBildruta: fn => requestAnimationFrame(fn),
    avbrytBildruta: h => cancelAnimationFrame(h as number),
    senare: (fn, ms) => setTimeout(fn, ms),
    avbrytSenare: h => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Kommer ingen rörelsehändelse på så här länge räknas kartan som stilla. */
const RÖRELSE_TYST_MS = 300;
/** Två rörelsehändelser tätare än så ritas som en. */
const MINSTA_RAM_MS = 6;
/** Zoomen har ändrats (webbens zoomstart) när den flyttat sig så här mycket. */
const ZOOM_STEG = 0.001;
/** Så långt från vyns mitt får en uppmätt kameramitt ligga (sättMitt). */
const MITT_SIDLED_PT = 2;
const MITT_HÖJDLED_PT = 70;
/** Har kartan flyttat sig så här långt sedan molnen lades ut, läggs de ut på
 *  nytt - innan lagrets kant (VY_RAND_PT) hinner komma in i bild. */
const NY_RAM_FLYTT_PT = VY_RAND_PT * 0.6;

export class MolnMotor {
    private readonly molnPlatser: MolnPlatser;
    private readonly skuggPlatser: MolnPlatser;
    private molnVyer: readonly VyData[];
    private skuggVyer: readonly VyData[];

    private värld: MolnVärld = nyVärld();
    private ram: MolnRam = { skuggor: [], moln: [] };
    private molnUt: number[] = [];
    private skuggUt: number[] = [];
    /** Kameran bildvyerna ligger utlagda för (lagrets egna koordinater). */
    private ankare: MolnKamera | null = null;
    /** Kameran vid senaste utläggningen. */
    private ritadKamera: MolnKamera | null = null;
    private visad: MolnBild | null = null;

    private vy: MolnVy | null = null;
    private bredd = 0;
    private höjd = 0;
    /** Kamerans uppmätta mitt på skärmen (sättMitt), null = vyns mitt. */
    private mitt: { x: number; y: number } | null = null;
    private punkter: readonly CloudPoint[] = [];
    private fokus: CloudPoint | null = null;
    private fria: readonly CloudPoint[] = [];
    private tryckPunkt: CloudPoint | null = null;
    /** En zoomning avväpnar trycket tills nästa tryck (#210). */
    private tryckVäpnat = true;
    private stilla = false;
    private aktiv = true;
    private stängd = false;

    private rörSig = false;
    private senastRörelse = 0;
    private senastRam = 0;
    private senastRitad = 0;
    private senastBygge = 0;
    /** Något rör sig fortfarande (knuff eller övertoning) - rita varje bildruta. */
    private animerar = false;
    /** Något har ändrats sedan senaste ritningen. */
    private smutsig = true;
    private bildHandtag: unknown = null;
    private viloHandtag: unknown = null;

    constructor(
        private readonly ut: MotorUt,
        behov: { moln: number; skuggor: number },
        private readonly klocka: MotorKlocka = SYSTEMKLOCKA,
    ) {
        this.molnPlatser = nyaPlatser(behov.moln);
        this.skuggPlatser = nyaPlatser(behov.skuggor);
        this.molnVyer = tommaVyer(behov.moln);
        this.skuggVyer = tommaVyer(behov.skuggor);
    }

    /** Lagrets storlek i pt (samma yta som kartan). */
    sättStorlek(bredd: number, höjd: number): void {
        if (bredd === this.bredd && höjd === this.höjd) return;
        this.bredd = bredd;
        this.höjd = höjd;
        // Ny storlek (vriden skärm): den uppmätta mitten gäller inte längre.
        this.mitt = null;
        if (this.synlig()) this.byggOm(this.klocka.nu());
        this.smutsa();
    }

    /**
     * Var på skärmen kamerans mitt ligger, uppmätt med kartans egen
     * projektion. Den native kartan kan lägga mitten en bit från vyns mitt
     * (iOS räknar bort statusraden och hemstrecket). En mätning som ligger
     * långt från vyns mitt, eller i sidled, togs medan kartan rörde sig och
     * släpps.
     */
    sättMitt(x: number, y: number): void {
        if (!(this.bredd > 0) || !(this.höjd > 0)) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (Math.abs(x - this.bredd / 2) > MITT_SIDLED_PT || Math.abs(y - this.höjd / 2) > MITT_HÖJDLED_PT) return;
        if (this.mitt && Math.abs(this.mitt.x - x) < 0.5 && Math.abs(this.mitt.y - y) < 0.5) return;
        this.mitt = { x, y };
        if (this.synlig()) this.byggOm(this.klocka.nu());
        this.smutsa();
    }

    /** Eventens platser (webbens setPoints). */
    sättPunkter(punkter: readonly CloudPoint[]): void {
        this.punkter = punkter;
        if (this.värld.nivå != null) this.byggOm(this.klocka.nu());
        this.smutsa();
    }

    /** Det valda eventets plats - molnen håller sig undan därifrån (webbens setFocus). */
    sättFokus(punkt: CloudPoint | null): void {
        this.fokus = punkt;
        this.smutsa();
    }

    /** De tända brickornas platser - molnen tunnas ut över dem (lib/moln). */
    sättFria(fria: readonly CloudPoint[]): void {
        this.fria = fria;
        this.smutsa();
    }

    /** Minskad rörelse i systemet: ingen drift, slingan går bara när något ändras. */
    sättStilla(stilla: boolean): void {
        this.stilla = stilla;
        this.smutsa();
    }

    /** Skärmen visas och appen är framme - annars står slingan still. */
    sättAktiv(aktiv: boolean): void {
        if (aktiv === this.aktiv) return;
        this.aktiv = aktiv;
        if (aktiv) this.smutsa();
        else this.avbryt();
    }

    /** Där man tryckte - molnen skingras där (webbens setTouchPoint). */
    tryck(punkt: CloudPoint | null): void {
        this.tryckPunkt = punkt;
        this.tryckVäpnat = true;
        this.smutsa();
    }

    /** Kartan rör sig (MapLibres onRegionIsChanging) - webbens 'render' under rörelse. */
    rörelse(vy: MolnVy): void {
        const nu = this.klocka.nu();
        this.sättVy(vy);
        this.rörSig = true;
        this.senastRörelse = nu;
        const kamera = this.kamera();
        if (!this.aktiv || this.stängd || !kamera) return;
        if (!this.synlig() && this.värld.rensad) return;
        // Nya rutor kommer in i bild när kartan flyttas - bygg om då och då.
        if (nu - this.senastBygge >= BYGG_OM_MS) this.byggOm(nu);
        // Molnen läggs ut på nytt när något animeras, i vilotakt (zoomens
        // täthet, skuggorna, driften) och innan lagrets kant kommer in i bild.
        // Däremellan följer hela lagret kartan som en enda vy.
        const nyRam = this.smutsig || this.animerar
            || nu - this.senastRitad >= VILO_RAM_MS || this.förbiKanten(kamera);
        if (nyRam && nu - this.senastRitad >= MINSTA_RAM_MS) {
            this.rita(nu);
        } else {
            if (nyRam) this.smutsig = true;
            this.följ(kamera);
        }
        this.planera();
    }

    /** Kartan har stannat (onRegionDidChange, och första vyn vid start) - webbens moveend. */
    stannat(vy: MolnVy): void {
        this.sättVy(vy);
        this.rörSig = false;
        if (this.synlig()) this.byggOm(this.klocka.nu());
        this.smutsa();
    }

    /** Något har ändrats: lägg ut molnen på nytt i nästa bildruta. */
    private smutsa(): void {
        this.smutsig = true;
        this.planera();
    }

    stäng(): void {
        this.stängd = true;
        this.avbryt();
    }

    private sättVy(vy: MolnVy): void {
        // En händelse utan kamera (kartan har ingen vy än) ändrar ingenting.
        if (!vy || !vy.center) return;
        // En zoomning knuffar aldrig (#210): kartan krymper kring trycket och
        // drar in molnen under det. Trycket väcks först av nästa tryck.
        if (this.vy && Math.abs(vy.zoom - this.vy.zoom) > ZOOM_STEG) this.tryckVäpnat = false;
        this.vy = { center: [vy.center[0], vy.center[1]], zoom: vy.zoom, bearing: vy.bearing, pitch: vy.pitch };
    }

    private kamera(): MolnKamera | null {
        const vy = this.vy;
        if (!vy || !(this.bredd > 0) || !(this.höjd > 0)) return null;
        if (!Number.isFinite(vy.zoom) || !Number.isFinite(vy.center[0]) || !Number.isFinite(vy.center[1])) return null;
        return {
            lng: vy.center[0],
            lat: vy.center[1],
            zoom: vy.zoom,
            bäring: Number.isFinite(vy.bearing) ? vy.bearing : 0,
            lutning: Number.isFinite(vy.pitch) ? vy.pitch : 0,
            bredd: this.bredd,
            höjd: this.höjd,
            mittX: this.mitt?.x,
            mittY: this.mitt?.y,
        };
    }

    private synlig(): boolean {
        return this.vy != null && cloudOpacityForZoom(this.vy.zoom) > 0.002;
    }

    private byggOm(nu: number): void {
        const kamera = this.kamera();
        if (!kamera) return;
        this.senastBygge = nu;
        byggOm(this.värld, this.punkter, kamera);
        this.smutsig = true;
    }

    /** Har kartan lämnat det molnen lades ut för - vridits, lutats eller gått förbi lagrets kant? */
    private förbiKanten(kamera: MolnKamera): boolean {
        const ankare = this.ankare;
        const ritad = this.ritadKamera;
        if (!ankare || !ritad || !sammaPlan(ankare, kamera) || !sammaPlan(ritad, kamera)) return true;
        const b = behållareFör(ritad, kamera);
        // Utzoomning drar in det som låg utanför kanten: räkna hur långt skärmens hörn flyttat sig.
        const krymp = (1 / b.skala - 1) * Math.max(kamera.bredd, kamera.höjd) / 2;
        return Math.abs(b.tx) > NY_RAM_FLYTT_PT || Math.abs(b.ty) > NY_RAM_FLYTT_PT || krymp > NY_RAM_FLYTT_PT;
    }

    /** Låt lagret följa kartan utan att lägga ut molnen på nytt. */
    private följ(kamera: MolnKamera): void {
        const ankare = this.ankare;
        if (!ankare || !sammaPlan(ankare, kamera)) return;
        const b = behållareFör(ankare, kamera);
        this.skicka(b.tx, b.ty, b.skala);
    }

    private skicka(tx: number, ty: number, skala: number): void {
        const v = this.visad;
        if (v && v.tx === tx && v.ty === ty && v.skala === skala && v.moln === this.molnVyer && v.skuggor === this.skuggVyer) return;
        this.visad = { tx, ty, skala, moln: this.molnVyer, skuggor: this.skuggVyer };
        this.ut.visa(this.visad);
    }

    private rita(nu: number): void {
        const kamera = this.kamera();
        if (!kamera) return;
        const dt = this.senastRam ? Math.min(100, nu - this.senastRam) : 16;
        this.senastRam = nu;
        this.senastRitad = nu;
        this.smutsig = false;
        const knuffare: CloudPoint[] = [];
        if (this.fokus) knuffare.push(this.fokus);
        if (this.tryckPunkt && this.tryckVäpnat) knuffare.push(this.tryckPunkt);
        const nivåFöre = this.värld.nivå;
        this.animerar = bildruta(this.värld, kamera, {
            punkter: this.punkter,
            knuffare,
            fria: this.fria,
            dtMs: dt,
            nuMs: nu,
            stilla: this.stilla,
            rand: VY_RAND_PT,
        }, this.ram);
        // Bildrutan byggde själv om molnen vid ett nivåbyte: som på webben
        // börjar då väntan till nästa ombygge om från nu.
        if (this.värld.nivå !== nivåFöre) this.senastBygge = nu;
        fördela(this.skuggPlatser, this.ram.skuggor, this.skuggUt);
        fördela(this.molnPlatser, this.ram.moln, this.molnUt);
        // Ankaret står kvar så länge kartan bara panorerats och zoomats -
        // då behåller oförändrade moln sina värden och ritas inte om.
        if (!this.ankare || !sammaPlan(this.ankare, kamera)) this.ankare = kamera;
        const b = behållareFör(this.ankare, kamera);
        this.skuggVyer = läggIVyer(this.skuggVyer, this.ram.skuggor, this.skuggUt, b, kamera.bredd, kamera.höjd);
        this.molnVyer = läggIVyer(this.molnVyer, this.ram.moln, this.molnUt, b, kamera.bredd, kamera.höjd);
        this.ritadKamera = kamera;
        this.skicka(b.tx, b.ty, b.skala);
    }

    private tick = (nu: number): void => {
        if (this.stängd || !this.aktiv) return;
        if (this.rörSig && nu - this.senastRörelse > RÖRELSE_TYST_MS) {
            // Kartan slutade röra sig utan att säga till (en avbruten kamerarörelse).
            this.rörSig = false;
            if (this.synlig()) this.byggOm(nu);
        }
        // Under kartrörelser ritar rörelsehändelserna - utom det som blivit över.
        const due = this.rörSig
            ? this.smutsig && nu - this.senastRitad >= MINSTA_RAM_MS
            : this.animerar || this.smutsig || (!this.stilla && nu - this.senastRitad >= VILO_RAM_MS);
        if (due) this.rita(nu);
        this.planera();
    };

    /** Håll slingan igång bara när det finns något att rita. */
    private planera(): void {
        if (this.stängd || !this.aktiv || this.bildHandtag != null) return;
        // Utan vy eller storlek finns inget att rita - första vyn väcker motorn.
        if (!this.kamera()) return;
        if (this.smutsig || this.animerar || this.rörSig) {
            if (this.viloHandtag != null) {
                this.klocka.avbrytSenare(this.viloHandtag);
                this.viloHandtag = null;
            }
            this.bildHandtag = this.klocka.nästaBildruta(nu => {
                this.bildHandtag = null;
                this.tick(nu);
            });
            return;
        }
        // Vila: driften ritas glest. Utan synliga moln eller med minskad
        // rörelse finns inget att rita - då sover motorn tills något ändras.
        if (this.viloHandtag != null || this.stilla || !this.synlig()) return;
        this.viloHandtag = this.klocka.senare(() => {
            this.viloHandtag = null;
            this.tick(this.klocka.nu());
        }, VILO_RAM_MS);
    }

    private avbryt(): void {
        if (this.bildHandtag != null) this.klocka.avbrytBildruta(this.bildHandtag);
        if (this.viloHandtag != null) this.klocka.avbrytSenare(this.viloHandtag);
        this.bildHandtag = null;
        this.viloHandtag = null;
    }
}
