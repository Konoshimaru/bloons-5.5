// js/bosses/knightMusic.js
let _bossMusic = null;

export function getBossMusic() {
    if (!_bossMusic) {
        _bossMusic = new Audio('music/boss/blackknife.mp3');
        _bossMusic.loop = true;
    }
    return _bossMusic;
}