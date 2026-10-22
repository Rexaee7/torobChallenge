// Persian text normalization for search. Display strings are never changed;
// only the indexed/query copy goes through this.

const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی",
  "ى": "ی",
  "ئ": "ی",
  "ك": "ک",
  "ة": "ه",
  "ۀ": "ه",
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ؤ": "و",
};

const DIGITS: Record<string, string> = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));

// Arabic diacritics (harakat), tatweel, superscript alef.
const DIACRITICS = /[ً-ٰٟـ]/g;
// ZWNJ, ZWJ, LRM/RLM and other invisible formatting chars.
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;
const PUNCT = /[.,،؛;:!؟?"'`()\[\]{}<>«»\-_/\\|+*=#%^&~@]+/g;

export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d);
}

export function normalizeFa(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.toLowerCase();
  s = s.replace(/[يىئكةۀأإآٱؤ]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
  s = toLatinDigits(s);
  s = s.replace(DIACRITICS, "");
  s = s.replace(INVISIBLE, " ");
  s = s.replace(PUNCT, " ");
  // split letters from digits so "a54" matches "a 54" and vice versa
  s = s.replace(/([a-z؀-ۿ])(\d)/g, "$1 $2").replace(/(\d)([a-z؀-ۿ])/g, "$1 $2");
  return s.replace(/\s+/g, " ").trim();
}

export function toPersianDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
