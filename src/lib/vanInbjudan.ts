/**
 * Vän-inbjudan från profilen - port av webbens utils/friendInvite (Josef
 * 13/10: "lägga till en vän direkt i profilen så man delar en länk och
 * bjuder in någon ... 1 var"). Länken landar alltid i WEBBEN (appens
 * universella länkar tar bara /e/, /evenemang/ och /arrangor/), där
 * mottagaren tackar ja och Cloud-funktionen acceptFriendInvite gör er till
 * vänner och ger nya konton en stjärna var (inbjudaren högst 5 gånger).
 * Ändras länkens form på webben ska den här följa.
 */

export const VÄN_INBJUDAN_BAS = 'https://vadkul.se';

export function vänInbjudningsUrl(uid: string): string {
    return `${VÄN_INBJUDAN_BAS}/?van=${encodeURIComponent(uid)}`;
}

/** Delningstexten - samma som webbens FRIEND_INVITE_TEXT. */
export const VÄN_INBJUDAN_TEXT = 'Häng med på VADKUL - kartan över allt som händer runt oss! Skapa konto via länken så blir vi vänner och får en stjärna var ⭐';
