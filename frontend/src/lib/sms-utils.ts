/**
 * SMS Segment Calculator
 * 
 * Logic:
 * GSM-7: 
 *  - 0-160 chars = 1 segment
 *  - >160 chars = 153 chars per segment (7 char header)
 * 
 * UCS-2 (if any special char/emoji present):
 *  - 0-70 chars = 1 segment
 *  - >70 chars = 67 chars per segment (3 char header)
 */

export type EncodingType = 'GSM-7' | 'UCS-2';

// Standard GSM-7 character set (basic + extended)
const gsm7Chars = new Set([
    '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
    'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', '\x1B', 'Æ', 'æ', 'ß', 'É',
    ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
    '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
    '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à'
]);

// Extended GSM characters take 2 bytes (count as 2 chars in calculation)
const gsm7ExtendedChars = new Set(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export function getEncoding(text: string): EncodingType {
    for (const char of text) {
        if (!gsm7Chars.has(char) && !gsm7ExtendedChars.has(char)) {
            return 'UCS-2';
        }
    }
    return 'GSM-7';
}

export interface SegmentStats {
    encoding: EncodingType;
    segments: number;
    charCount: number;
    bytes: number;
    perSegmentLimit: number;
    maxSingleSegment: number;
}

export function calculateSegments(text: string): SegmentStats {
    const encoding = getEncoding(text);
    let charCount = text.length;
    let bytes = 0;

    // Calculate bytes/length precisely
    if (encoding === 'GSM-7') {
        for (const char of text) {
            if (gsm7ExtendedChars.has(char)) {
                bytes += 2; // Extended chars take 2 slots
            } else {
                bytes += 1;
            }
        }
        // Using bytes as effective char count for GSM limit checks
        charCount = bytes;
    } else {
        // UCS-2: each char is 2 bytes, but we count logical characters for segmentation rules usually
        // However, for calculation we just use length, as standard emoji is 2 chars (surrogate pair) in JS
        // We will stick to Javascript string length for simplicity, 
        // unless high-fidelity surrogate pair counting is needed.
        // Length of "👍" in JS is 2.
        charCount = [...text].length; // Use spread to count code points (emojis as 1)?
        // Actually, Twilio counts UCS-2 by UTF-16 code units usually.
        // Let's use standard length.
        charCount = text.length;
    }

    let segments = 1;
    let maxSingleSegment = 160;
    let perSegmentLimit = 153;

    if (encoding === 'UCS-2') {
        maxSingleSegment = 70;
        perSegmentLimit = 67;
    }

    if (charCount > maxSingleSegment) {
        segments = Math.ceil(charCount / perSegmentLimit);
    }

    return {
        encoding,
        segments,
        charCount,
        bytes: encoding === 'UCS-2' ? text.length * 2 : bytes,
        perSegmentLimit,
        maxSingleSegment
    };
}

export function estimateCost(segments: number, recipients: number, costPerSegment = 0.0079): number {
    return parseFloat((segments * recipients * costPerSegment).toFixed(4));
}
