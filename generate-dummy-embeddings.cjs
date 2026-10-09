const fs = require('fs');
const verses = require('./public/bible.json');

const EMBEDDING_DIM = 384;
const totalVerses = verses.length;
const totalSize = totalVerses * EMBEDDING_DIM * 4; // 4 bytes per float32

const buffer = Buffer.alloc(totalSize);

for (let i = 0; i < totalVerses; i++) {
  // Generate a dummy normalized vector
  let sum = 0;
  const vec = new Float32Array(EMBEDDING_DIM);
  for (let j = 0; j < EMBEDDING_DIM; j++) {
    vec[j] = Math.random() - 0.5;
    sum += vec[j] * vec[j];
  }
  const norm = Math.sqrt(sum);
  
  for (let j = 0; j < EMBEDDING_DIM; j++) {
    const val = vec[j] / norm;
    buffer.writeFloatLE(val, (i * EMBEDDING_DIM + j) * 4);
  }
}

fs.writeFileSync('./public/bible-embeddings.bin', buffer);
console.log('Created dummy bible-embeddings.bin');
