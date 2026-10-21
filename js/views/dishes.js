/* Round 5 (7.6): the photo for a recipe — a dish photo either phone took (kept on this phone once fetched), the imported
 * page's photo, the built-in's picture, else nothing (the caller shows the kind's tile). Its own module so Meals and the
 * recipe page can both use it without importing each other (publishing stamps modules by content and needs a tree).
 * Round 6 (1.8): planner-made and typed meals get a photo too — the back office makes one per meal (same rules as the
 * built-ins' photos) and keeps it with the dish photos, under the recipe's id or the meal's name (L.mealKey). Each is
 * shrunk to 480 px on this phone before it's kept, and only the newest 60 are kept. */
import { K, L } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { call, LS } from '../api.js?v=b8330e966d';
import { rerender } from '../nav.js?v=57c55c9996';

const dishLoading = new Set();
const MAX_KEPT = 60;
/** A dish photo is fetched from the back office once and kept on this phone (both phones show it). */
export function rememberDish(id, dataUrl) { const d = ((S.r5() || {}).dishPhotos || {})[id]; keep(id, d ? d.ts : 'new', dataUrl); }
function keep(id, v, data) {
  try {
    const keys = LS.json('op_dish_keys', []).filter((k) => k !== id).concat([id]);
    while (keys.length > MAX_KEPT) LS.del('op_dish_' + keys.shift());
    LS.set('op_dish_' + id, JSON.stringify({ v, data }));
    LS.set('op_dish_keys', JSON.stringify(keys));
  } catch (e) { /* full: it shows next time from the back office */ }
}
/** Shrinks a fetched photo to 480 px (a meal row is 64 px, the recipe page about 400 px) so dozens fit on the phone. */
function shrink(dataUrl) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
        if (s >= 1 && dataUrl.length < 120000) { res(dataUrl); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.82);
        res(out.length > 1000 ? out : dataUrl);
      } catch (e) { res(dataUrl); }
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}
function dishUrl(id) {
  const d = ((S.r5() || {}).dishPhotos || {})[id];
  if (!d) return '';
  const c = LS.json('op_dish_' + id, null);
  if (c && (c.v === d.ts || c.v === 'new') && c.data) return c.data;
  if (!dishLoading.has(id)) {
    dishLoading.add(id);
    call('r5DishGet', { recipeId: id }, { timeout: 60000 }).then(async (r) => { if (r && r.data) { keep(id, d.ts, await shrink(r.data)); rerender(); } }).catch(() => {});
  }
  return '';
}
export function photoOf(recipe) {
  if (!recipe) return '';
  const dish = dishUrl(recipe.id);
  if (dish) return dish;
  if (recipe.image) return recipe.image;
  if (K.RECIPES.some((x) => x.id === recipe.id)) return 'img/recipes/' + recipe.id + '.webp';
  if (recipe.photoOf) return 'img/recipes/' + recipe.photoOf + '.webp'; // a planner-made copy of a built-in
  return '';
}
/** A meal written as words (no recipe): its photo under the meal's name. */
export function mealPhoto(title) { return title ? dishUrl(L.mealKey(title)) : ''; }
