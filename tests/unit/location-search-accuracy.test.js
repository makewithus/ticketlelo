import test from "node:test";
import assert from "node:assert/strict";
import { searchIndianVenues, INDIAN_VENUES_CATALOG } from "../../lib/venues-catalog.js";

test("Venue Catalog: Catalog contains verified Indian colleges and venues", () => {
  assert.ok(Array.isArray(INDIAN_VENUES_CATALOG), "Catalog should be an array");
  assert.ok(INDIAN_VENUES_CATALOG.length >= 40, "Catalog should have comprehensive venue coverage");

  for (const v of INDIAN_VENUES_CATALOG) {
    assert.ok(v.id, "Venue must have an id");
    assert.ok(v.name, "Venue must have a name");
    assert.ok(v.address, "Venue must have an address");
    assert.ok(typeof v.lat === "number" && v.lat >= 8 && v.lat <= 38, `Valid Indian latitude for ${v.name}`);
    assert.ok(typeof v.lng === "number" && v.lng >= 68 && v.lng <= 98, `Valid Indian longitude for ${v.name}`);
  }
});

test("Acronym Accuracy: AKGEC resolves accurately without maps API key", () => {
  const akgecResults = searchIndianVenues("AKGEC");
  assert.ok(akgecResults.length > 0, "Should return results for AKGEC");
  const top = akgecResults[0];
  assert.equal(top.id, "col-akgec");
  assert.ok(top.name.includes("Ajay Kumar Garg Engineering College"));
  assert.ok(top.address.includes("Ghaziabad"));
  assert.ok(top.isVerified, "AKGEC should be verified");
  assert.equal(top.lat, 28.675656);
  assert.equal(top.lng, 77.502912);
});

test("Prefix Accuracy: Partial typing 'AKGE' or 'AKG' resolves to AKGEC", () => {
  const akgeResults = searchIndianVenues("AKGE");
  assert.ok(akgeResults.length > 0, "Should return results for partial AKGE");
  assert.equal(akgeResults[0].id, "col-akgec");

  const akgResults = searchIndianVenues("akg");
  assert.ok(akgResults.length > 0, "Should return results for lowercase akg");
  assert.equal(akgResults[0].id, "col-akgec");
});

test("Colleges Accuracy: Resolves KIET, DTU, NSUT, and IIT Delhi", () => {
  const kiet = searchIndianVenues("KIET")[0];
  assert.ok(kiet, "KIET found");
  assert.ok(kiet.name.includes("KIET"));
  assert.equal(kiet.lat, 28.7533);
  assert.equal(kiet.lng, 77.4975);

  const dtu = searchIndianVenues("DTU")[0];
  assert.ok(dtu, "DTU found");
  assert.ok(dtu.name.includes("Delhi Technological University"));
  assert.equal(dtu.lat, 28.7501);
  assert.equal(dtu.lng, 77.1177);

  const nsut = searchIndianVenues("NSUT")[0];
  assert.ok(nsut, "NSUT found");
  assert.ok(nsut.name.includes("Netaji Subhas University of Technology"));
  assert.equal(nsut.lat, 28.608);

  const iit = searchIndianVenues("IIT Delhi")[0];
  assert.ok(iit, "IIT Delhi found");
  assert.ok(iit.name.includes("Indian Institute of Technology Delhi"));
  assert.equal(iit.lat, 28.545);
});

test("Convention Venues: Resolves Bharat Mandapam, CyberHub, and JLN Stadium", () => {
  const bm = searchIndianVenues("Bharat Mandapam")[0];
  assert.ok(bm, "Bharat Mandapam found");
  assert.ok(bm.name.includes("Bharat Mandapam"));
  assert.equal(bm.lat, 28.6186);

  const ch = searchIndianVenues("CyberHub")[0];
  assert.ok(ch, "CyberHub found");
  assert.ok(ch.name.includes("DLF CyberHub"));
  assert.equal(ch.lat, 28.495);

  const jln = searchIndianVenues("JLN Stadium")[0];
  assert.ok(jln, "JLN Stadium found");
  assert.ok(jln.name.includes("Jawaharlal Nehru Stadium"));
  assert.equal(jln.lat, 28.5828);
});
