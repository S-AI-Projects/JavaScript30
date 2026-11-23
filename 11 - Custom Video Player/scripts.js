(() => {
  const player = document.querySelector('.player');
  if (!player || player.dataset.playerInitialized === 'true') return;
  player.dataset.playerInitialized = 'true';

  const video = player.querySelector('.viewer');
  const progress = player.querySelector('.progress');
  const progressBar = player.querySelector('.progress__filled');
  const toggle = player.querySelector('.toggle');
  const skipButtons = player.querySelectorAll('[data-skip]');
  const ranges = player.querySelectorAll('.player__slider');

  function togglePlay() {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  function updateButton() {
    toggle.textContent = video.paused ? '►' : '❚ ❚';
  }

  function skip() {
    const amount = Number.parseFloat(this.dataset.skip);
    if (Number.isFinite(amount)) video.currentTime += amount;
  }

  function handleRangeUpdate() {
    if (this.name === 'volume' || this.name === 'playbackRate') {
      video[this.name] = Number(this.value);
    }
  }

  function handleProgress() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const percent = (video.currentTime / video.duration) * 100;
    progressBar.style.flexBasis = `${Math.min(100, Math.max(0, percent))}%`;
  }

  function scrub(event) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const bounds = progress.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const fraction = Math.min(1, Math.max(0, event.clientX - bounds.left) / bounds.width);
    video.currentTime = fraction * video.duration;
  }

  let isScrubbing = false;
  video.addEventListener('click', togglePlay);
  video.addEventListener('play', updateButton);
  video.addEventListener('pause', updateButton);
  video.addEventListener('timeupdate', handleProgress);
  toggle.addEventListener('click', togglePlay);
  skipButtons.forEach(button => button.addEventListener('click', skip));
  ranges.forEach(range => {
    range.addEventListener('input', handleRangeUpdate);
    range.addEventListener('change', handleRangeUpdate);
  });
  progress.addEventListener('click', scrub);
  progress.addEventListener('mousemove', event => {
    if (isScrubbing) scrub(event);
  });
  progress.addEventListener('mousedown', () => { isScrubbing = true; });
  window.addEventListener('mouseup', () => { isScrubbing = false; });
})();
