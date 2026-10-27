import { AdminForm, Check } from "@/components/admin/admin-form";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { saveSettingsAction } from "@/lib/admin/content-actions";
import { getSettings } from "@/lib/settings";
import { SETTINGS_DEFAULTS, type SettingKey } from "@/lib/settings-defaults";

export const metadata = { title: "Definições" };

const GROUPS: { title: string; items: [SettingKey, string, string?][] }[] = [
  { title: "Publicação e moderação", items: [
    ["listings.moderation", "Anúncios novos ficam à espera de aprovação"],
    ["listings.moderateEdits", "Anúncios editados voltam a precisar de aprovação"],
    ["listings.freeAdsPerUser", "Anúncios ativos por pessoa (plano grátis)"],
  ] },
  { title: "Validade", items: [
    ["listings.durationDays", "Duração de um anúncio (dias)"],
    ["listings.expiryWarningDays", "Avisar o anunciante X dias antes de expirar"],
    ["listings.reminderAfterDays", "Lembrete de renovação X dias depois de expirar"],
    ["listings.deleteExpiredAfterDays", "Apagar anúncios expirados ao fim de X dias"],
  ] },
  { title: "Formulário", items: [
    ["listings.titleMax", "Máximo de caracteres do título"],
    ["listings.descriptionMax", "Máximo de caracteres da descrição"],
    ["listings.maxImages", "Fotografias por anúncio"],
    ["listings.maxImageMb", "Tamanho máximo de cada fotografia (MB)"],
  ] },
  { title: "Listagens", items: [
    ["listings.perPage", "Anúncios por página"],
    ["listings.newLabelDays", "Etiqueta “Novo” durante X dias"],
    ["listings.popularViews", "Etiqueta “Popular” a partir de X visitas"],
  ] },
  { title: "Emails", items: [
    ["email.fromName", "Nome do remetente"],
    ["email.adminRecipients", "Emails da equipa que recebem avisos", "Separados por vírgulas. Vazio = todos os administradores."],
  ] },
];

export default async function AdminSettings() {
  await requireAdmin();
  const values = await getSettings(Object.keys(SETTINGS_DEFAULTS) as SettingKey[]);
  return (
    <>
      <AdminHeader title="Definições" intro="Valores iniciais iguais às definições do WordPress." />
      <AdminForm action={saveSettingsAction} submit="Guardar definições">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="panel grid gap-4 md:grid-cols-2">
            <legend className="float-left mb-1 w-full font-display text-lg font-bold">{g.title}</legend>
            {g.items.map(([key, label, hint]) => {
              const def = SETTINGS_DEFAULTS[key];
              const v = values[key] as unknown;
              if (typeof def === "boolean") return <div key={key} className="md:col-span-2"><Check name={key} label={label} defaultChecked={Boolean(v)} /></div>;
              return (
                <label key={key} className="field" htmlFor={key}>{label}
                  {hint && <span className="hint">{hint}</span>}
                  <input id={key} name={key} type={typeof def === "number" ? "number" : "text"} min={0} defaultValue={Array.isArray(v) ? v.join(", ") : String(v ?? "")} className="input" />
                </label>
              );
            })}
          </fieldset>
        ))}
      </AdminForm>
    </>
  );
}
