/* Round 5 (7.6): the photo for a recipe — a dish photo either phone took (kept on this phone once fetched), the imported
 * page's photo, the built-in's picture, else nothing (the caller shows the kind's tile). Its own module so Meals and the
 * recipe page can both use it without importing each other (publishing stamps modules by content and needs a tree). */
import { K } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=016968e4cd';
import { call, LS } from '../api.js?v=b8330e966d';
import { rerender } from '../nav.js?v=57c55c9996';

const dishLoading = new Set();
/** A dish photo is fetched from the back office once and kept on this phone (both phones show it). */
export function rememberDish(id, dataUrl) { const d = ((S.r5() || {}).dishPhotos || {})[id]; try { LS.set('op_dish_' + id, JSON.stringify({ v: d ? d.ts : 'new', data: dataUrl })); } catch (e) { /* full */ } }
function dishUrl(id) {
  const d = ((S.r5() || {}).dishPhotos || {})[id];
  if (!d) return '';
  const c = LS.json('op_dish_' + id, null);
  if (c && (c.v === d.ts || c.v === 'new') && c.data) return c.data;
  if (!dishLoading.has(id)) {
    dishLoading.add(id);
    call('r5DishGet', { recipeId: id }, { timeout: 60000 }).then((r) => { if (r && r.data) { try { LS.set('op_dish_' + id, JSON.stringify({ v: d.ts, data: r.data })); } catch (e) { /* full */ } rerender(); } }).catch(() => {});
  }
  return '';
}
export function photoOf(recipe) {
  if (!recipe) return '';
  const dish = dishUrl(recipe.id);
  if (dish) return dish;
  if (recipe.image) return recipe.image;
  if (K.RECIPES.some((x) => x.id === recipe.id)) return 'img/recipes/' + recipe.id + '.webp';
  return '';
}
