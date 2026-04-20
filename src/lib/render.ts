import type { Response } from "express";
import { eta } from "../server.js";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize","Benin","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Bulgaria","Burkina Faso","Burma","Burundi",
  "Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China",
  "Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark",
  "Djibouti","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea",
  "Estonia","Ethiopia","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece",
  "Guatemala","Guinea","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran",
  "Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kosovo",
  "Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein",
  "Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritania",
  "Mauritius","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Namibia",
  "Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia",
  "Norway","Oman","Pakistan","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland",
  "Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Sierra Leone",
  "Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","South Sudan","Spain",
  "Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania",
  "Thailand","Togo","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela",
  "Vietnam","Yemen","Zambia","Zimbabwe",
];

export function countryOptions(selected: string): string {
  const blank = `<option value=""></option>`;
  const opts = COUNTRIES.map((c) => {
    const sel = c === selected ? ' selected' : '';
    return `<option value="${c}"${sel}>${c}</option>`;
  }).join("");
  return blank + opts;
}

export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const base = { countryOptions, plan: res.locals.plan ?? null, isDemo: res.locals.isDemo ?? false };
  const body = await eta.renderAsync(view, { ...base, ...data });
  const html = await eta.renderAsync("layout", { ...base, ...data, body });
  res.send(html);
}
