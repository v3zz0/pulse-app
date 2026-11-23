import { reactive } from "vue";
import { api, send } from "./api";
// Foto profilo salvata nelle impostazioni personali dell'account.
export const profile = reactive({ avatar: null });
export async function loadProfile() {
  try { profile.avatar = (await api("/personal-settings")).data.avatar || null; } catch { profile.avatar = null; }
}
/** Ridimensiona a 256px (JPEG) nel browser e salva; null rimuove la foto. */
export async function saveAvatar(file) {
  let avatar = null;
  if (file) {
    if (!/^image\//.test(file.type)) throw new Error("Scegli un'immagine");
    const img = await createImageBitmap(file);
    const side = Math.min(img.width, img.height), canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
    avatar = canvas.toDataURL("image/jpeg", 0.85);
  }
  const current = await api("/personal-settings");
  await send("/personal-settings", { data: { ...current.data, avatar }, revision: current.revision, confirm: true });
  profile.avatar = avatar;
}
