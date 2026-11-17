<script setup>
import NutrientSummary from "./NutrientSummary.vue";
defineProps({ kind: String, plan: Object, goals: Object });
const status = {
  estimated: "Stimati",
  declared: "Dichiarati",
  verified: "Confermati dall’utente",
};
</script>
<template>
  <section v-if="plan" class="plan-preview" aria-label="Anteprima del piano">
    <h2>{{ plan.title }}</h2>
    <p class="smallmuted">
      Versione {{ plan.versionLabel || plan.version }} · {{ plan.externalId }}
    </p>
    <template v-if="kind === 'nutrition'">
      <p class="note">
        Menu alternativi completi. In ogni menu si sceglie un’alternativa per
        gruppo; i gruppi si sommano. I totali mostrano le scelte iniziali del
        piano.
      </p>
      <details
        v-for="(meals, day) in plan.meals"
        :key="day"
        open
        class="plan-day"
      >
        <summary>Giorno {{ day }} · {{ meals.length }} pasti</summary>
        <NutrientSummary :totals="plan.totals?.[day]" :goals="goals" />
        <article v-for="meal in meals" :key="meal.id" class="training-preview">
          <h3>{{ meal.time }} {{ meal.name }}</h3>
          <NutrientSummary :totals="meal.nutrientTotals" />
          <details v-for="(menu, mi) in meal.menus" :key="mi">
            <summary>{{ menu.title }}</summary>
            <div v-for="(group, gi) in menu.groups" :key="gi" class="csv-group">
              <b>Gruppo {{ gi + 1 }} · scegli una alternativa</b>
              <div v-for="o in group.options" :key="o.id" class="choice-card">
                <div>
                  <strong>{{ o.text }}</strong>
                  <p v-if="o.foodState" class="note">
                    Stato: {{ o.foodState }}
                  </p>
                  <p v-if="o.nutrition" class="note">
                    {{ status[o.nutrition.status] }} ·
                    {{ o.nutrition.basis || "Base assente"
                    }}{{
                      o.nutrition.basisQuantity
                        ? " · " + o.nutrition.basisQuantity + " " + o.unit
                        : ""
                    }}<br />kcal {{ o.nutrition.kcal ?? "—" }} · P
                    {{ o.nutrition.protein_g ?? "—" }} · C
                    {{ o.nutrition.carbs_g ?? "—" }} · G
                    {{ o.nutrition.fat_g ?? "—" }}<br />Fonte:
                    {{ o.nutrition.source || "Da verificare" }}
                  </p>
                  <p v-if="o.nutrientTotals" class="note">
                    Per la quantità indicata: kcal
                    {{ o.nutrientTotals.values.kcal ?? "—" }} · P
                    {{ o.nutrientTotals.values.protein_g ?? "—" }} g · C
                    {{ o.nutrientTotals.values.carbs_g ?? "—" }} g · G
                    {{ o.nutrientTotals.values.fat_g ?? "—" }} g
                  </p>
                  <p v-if="o.notes" class="note">{{ o.notes }}</p>
                  <p v-if="o.tags" class="note">Tag: {{ o.tags }}</p>
                </div>
              </div>
            </div>
            <p v-if="menu.notes" class="warning">{{ menu.notes }}</p>
          </details>
          <p v-if="meal.sourceText" class="note csv-text">
            {{ meal.sourceText }}
          </p>
        </article>
      </details>
      <p v-if="plan.notes" class="note csv-text">{{ plan.notes }}</p>
    </template>
    <template v-else>
      <details
        v-for="(blocks, day) in plan.days"
        :key="day"
        open
        class="plan-day"
      >
        <summary>Giorno {{ day }} · {{ blocks.length }} esercizi</summary>
        <article v-for="b in blocks" :key="b.id" class="training-preview">
          <h3>{{ b.name }}</h3>
          <p class="note">
            {{ b.prescriptionRaw }} · Recupero
            {{
              b.restSeconds === null
                ? (b.restRaw || "non indicato") + " · manuale"
                : b.restSeconds + " s"
            }}
          </p>
          <p v-if="b.movements.length" class="note">
            {{ b.movements.map((m) => m.name + " × " + m.reps).join(" → ") }}
          </p>
          <p v-for="(s, i) in b.sets" :key="s.id">
            Serie {{ i + 1 }} · {{ s.kind || b.phase }} · {{ s.reps
            }}{{ s.toFailure ? " · cedimento" : ""
            }}{{ s.perLeg ? " · per gamba" : "" }} · Standard
            {{ s.standardKg === null ? "da impostare" : s.standardKg + " kg" }}
          </p>
          <p
            v-for="s in b.sets.filter((s) => s.movements?.length)"
            :key="s.id + 'moves'"
            class="note"
          >
            Serie {{ s.order }}:
            {{ s.movements.map((m) => m.name + " × " + m.reps).join(" → ") }}
          </p>
          <p class="note csv-text">{{ b.notes }}</p>
        </article>
      </details>
      <p v-if="plan.cooldown" class="note">
        {{ plan.cooldown.name }} ·
        {{
          plan.cooldown.durationSeconds
            ? plan.cooldown.durationSeconds + " secondi"
            : "durata da verificare"
        }}<br />{{ plan.cooldown.sourceText }}
      </p>
    </template>
  </section>
</template>
