import PocketBase from "pocketbase";
import { readFile, readdir } from "fs/promises";
import path from "path";

const PB_URL = "https://pocketbase.superflow.es/";
const COMPANY_ID = "e5x5scj9xumw7c9";
const EMAIL = process.env.PB_EMAIL || "carlos@carlos.com";
const PASSWORD = process.env.PB_PASSWORD || "tactivo123";

const equipmentNames = [
    "Mancuernas",
    "Barra",
    "Kettlebell",
    "Banco plano",
    "Banco inclinado",
    "Máquina polea",
    "Banda elástica",
    "TRX",
    "Esterilla",
    "Fitball",
    "Cuerda de batalla",
    "Caja pliométrica",
    "Máquina remo",
    "Bicicleta estática",
    "Cinta de correr",
    "Disco",
    "Saco de arena",
    "GHD",
    "Máquina prensa",
    "Peso corporal",
];

const anatomyNames = [
    "Pecho",
    "Espalda",
    "Hombro anterior",
    "Hombro lateral",
    "Hombro posterior",
    "Bíceps",
    "Tríceps",
    "Antebrazo",
    "Cuádriceps",
    "Isquios",
    "Glúteo",
    "Gemelo",
    "Core",
    "Oblicuos",
    "Lumbares",
    "Cadera",
    "Rodilla",
    "Tobillo",
    "Muñeca",
    "Cuello",
];

const exerciseNames = [
    "Press banca",
    "Dominadas",
    "Sentadilla",
    "Peso muerto",
    "Press militar",
    "Remo con barra",
    "Zancadas",
    "Fondos paralelas",
    "Curl bíceps",
    "Extensión tríceps polea",
    "Hip thrust",
    "Face pull",
    "Press inclinado mancuernas",
    "Remo mancuerna",
    "Curl femoral",
    "Prensa de piernas",
    "Elevaciones laterales",
    "Elevaciones de talón",
    "Plancha",
    "Pallof press",
];

const equipmentMediaDir = path.resolve("public/test_equipment");
const exerciseMediaDir = path.resolve("public/test_exercises");

async function login(pb) {
    await pb.collection("users").authWithPassword(EMAIL, PASSWORD);
}

async function loadBlob(filePath, mime) {
    const buffer = await readFile(filePath);
    return new Blob([buffer], { type: mime });
}

async function upsertByName(pb, collection, name) {
    try {
        const existing = await pb
            .collection(collection)
            .getFirstListItem(`name = "${name}" && company = "${COMPANY_ID}"`, {
                requestKey: null,
            });
        return existing;
    } catch {
        // not found
    }
    const data = { name, company: COMPANY_ID };
    return pb.collection(collection).create(data);
}

async function createEquipment(pb, names) {
    const mediaFiles = await readdir(equipmentMediaDir);
    const records = [];
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const fileName = mediaFiles[i % mediaFiles.length];
        const filePath = path.join(equipmentMediaDir, fileName);
        const fd = new FormData();
        fd.append("name", name);
        fd.append("company", COMPANY_ID);
        try {
            const blob = await loadBlob(filePath, "image/jpeg");
            fd.append("file", blob, fileName);
        } catch {
            // file optional; ignore
        }
        try {
            const rec = await pb.collection("equipment").create(fd);
            records.push(rec);
        } catch {
            // retry without file if schema disallows file
            try {
                const rec = await pb.collection("equipment").create({ name, company: COMPANY_ID });
                records.push(rec);
            } catch (err2) {
                console.error("Error creating equipment", name, err2?.message || err2);
            }
        }
    }
    return records;
}

async function createAnatomy(pb, names) {
    const records = [];
    for (const name of names) {
        try {
            const rec = await upsertByName(pb, "anatomy", name);
            records.push(rec);
        } catch (err) {
            console.error("Error creating anatomy", name, err?.message || err);
        }
    }
    return records;
}

function pickMany(list, count, seedIndex) {
    const rotated = [...list.slice(seedIndex), ...list.slice(0, seedIndex)];
    return rotated.slice(0, count).map((x) => x.id);
}

async function createExercises(pb, names, anatomy, equipment, mediaFiles) {
    const records = [];
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const anatomyIds = pickMany(anatomy, 2, i % anatomy.length);
        const equipmentIds = pickMany(equipment, 2, i % equipment.length);
        const videoName = mediaFiles[i % mediaFiles.length];
        const videoPath = path.join(exerciseMediaDir, videoName);

        const fd = new FormData();
        fd.append("name", name);
        fd.append("description", `${name} - ejemplo`);
        fd.append("company", COMPANY_ID);
        fd.append("anatomy", JSON.stringify(anatomyIds));
        fd.append("equipment", JSON.stringify(equipmentIds));

        try {
            const blob = await loadBlob(videoPath, "video/mp4");
            fd.append("file", blob, videoName);
        } catch {
            // optional
        }

        try {
            const rec = await pb.collection("exercises").create(fd);
            records.push(rec);
        } catch {
            // fallback without file
            try {
                const rec = await pb.collection("exercises").create({
                    name,
                    description: `${name} - ejemplo`,
                    company: COMPANY_ID,
                    anatomy: anatomyIds,
                    equipment: equipmentIds,
                });
                records.push(rec);
            } catch (err2) {
                console.error("Error creating exercise", name, err2?.message || err2);
            }
        }
    }
    return records;
}

async function main() {
    const pb = new PocketBase(PB_URL);
    await login(pb);

    // Load media filenames
    const exerciseMedia = await readdir(exerciseMediaDir);

    const anatomyRecords = await createAnatomy(pb, anatomyNames);
    const equipmentRecords = await createEquipment(pb, equipmentNames);
    const exerciseRecords = await createExercises(pb, exerciseNames, anatomyRecords, equipmentRecords, exerciseMedia);

    console.log({
        anatomyCreated: anatomyRecords.length,
        equipmentCreated: equipmentRecords.length,
        exercisesCreated: exerciseRecords.length,
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
