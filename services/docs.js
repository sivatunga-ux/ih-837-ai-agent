export function simulateCCD(memberId, uid) {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument>
  <id extension="${uid()}" />
  <title>CCD (Demo)</title>
  <recordTarget><patientRole><id extension="${memberId}" /></patientRole></recordTarget>
  <component><structuredBody>
    <component><section>
      <title>Problems</title>
      <text>Diabetes mellitus; CKD/ESRD; status conditions (demo)</text>
    </section></component>
  </structuredBody></component>
</ClinicalDocument>`;
  return { name: `CCD_${memberId}.xml`, type: "xml", contentPreview: content.slice(0, 1200) };
}

export function addDocToLibrary(doclib, memberId, fileName, type, contentPreview, uid, nowISO) {
  const doc = { id: uid(), memberId, name: fileName, type, createdAt: nowISO(), contentPreview };
  doclib.unshift(doc);
  return doc;
}
