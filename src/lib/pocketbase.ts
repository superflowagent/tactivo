import PocketBase from 'pocketbase';

// Inicializa la instancia de PocketBase
const pb = new PocketBase('https://pocketbase.superflow.es/');

// Desactiva la auto-cancelación para evitar problemas en desarrollo
pb.autoCancellation(false);

export default pb;
