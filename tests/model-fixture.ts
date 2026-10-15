import { readFile } from 'node:fs/promises';
import { installAthleteModel } from '../src/athlete-model.ts';
const bytes = await readFile(new URL('../assets/athlete.glb', import.meta.url));
await installAthleteModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

const sdBytes = await readFile(new URL('../assets/athlete-sd.glb', import.meta.url));
await installAthleteModel(sdBytes.buffer.slice(sdBytes.byteOffset, sdBytes.byteOffset + sdBytes.byteLength), 'sd');
