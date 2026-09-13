import playUrl from './assets/static_sound_play.wav'
import disableUrl from './assets/static_sound_disable.wav'

const play = new Audio(playUrl)
const disable = new Audio(disableUrl)

export function playSound(enabling: boolean) {
  const audio = enabling ? play : disable
  audio.currentTime = 0
  void audio.play().catch(() => {})
}