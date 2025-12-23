import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase.superflow.es/');
const COMPANY = 'e5x5scj9xumw7c9';

async function main() {
    await pb.collection('users').authWithPassword('carlos@carlos.com', 'tactivo123');
    const exercises = await pb.collection('exercises').getFullList({ filter: `company = "${COMPANY}"` });
    const equipment = await pb.collection('equipment').getFullList({ filter: `company = "${COMPANY}"` });
    console.log('exercises', exercises.length, exercises[0]?.file, exercises[0]?.id);
    console.log('equipment', equipment.length, equipment[0]?.file, equipment[0]?.id);
}

main();
