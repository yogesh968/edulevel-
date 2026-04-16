export function splitTextIntoChunks(text, wordsPerChunk = 400) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = [];

    for (let word of words) {
        currentChunk.push(word);
        if (currentChunk.length >= wordsPerChunk) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    return chunks;
}
