exports.seed = async function (knex) {
  const treatments = [
    { name: "Gel Manicure", duration_minutes: 45, price_pence: 3500 },
    { name: "Blow Dry", duration_minutes: 60, price_pence: 4000 },
    { name: "Deep Tissue Massage", duration_minutes: 90, price_pence: 7500 },
    { name: "Express Facial", duration_minutes: 30, price_pence: 3000 },
  ];

  await knex("treatments").insert(treatments).onConflict("name").merge();
};