import { describe, expect, it } from 'vitest';
import { audioStateOf } from '../audioGateLogic';
import { raisesPowerWarning } from '../powerWarningLogic';
import { clockContextOf } from '../clockContext';
import { calibrationDevices, calibrationText, midiPortText } from '../statusBarText';

describe('audio gate', () => {
  it('is off until initialised, then running or paused by the context state', () => {
    expect(audioStateOf(false, 'running')).toBe('off');
    expect(audioStateOf(true, 'running')).toBe('running');
    expect(audioStateOf(true, 'suspended')).toBe('paused');
    expect(audioStateOf(true, 'interrupted')).toBe('paused');
  });
});

describe('clockContextOf', () => {
  it('unwraps the native context Tone keeps, else passes the context through', () => {
    const native = { currentTime: 1, state: 'running', outputLatency: 0.02 };
    expect(clockContextOf({ _nativeAudioContext: native })).toBe(native);
    const plain = { currentTime: 1, state: 'running' };
    expect(clockContextOf(plain)).toBe(plain);
  });
});

describe('power warning', () => {
  const port = { id: 'p', name: 'p', manufacturer: '' };
  it('shows on a MIDI input connecting, and nothing else', () => {
    expect(raisesPowerWarning({ type: 'port', kind: 'input', port, state: 'connected' })).toBe(true);
    expect(raisesPowerWarning({ type: 'port', kind: 'output', port, state: 'connected' })).toBe(false);
    expect(raisesPowerWarning({ type: 'port', kind: 'input', port, state: 'disconnected' })).toBe(false);
    expect(raisesPowerWarning({ type: 'selection', input: port, output: null })).toBe(false);
  });
});

describe('status bar text', () => {
  it('calibration is per active source', () => {
    const devices = calibrationDevices(['touch', 'midi'], 'Some Port');
    expect(devices).toEqual([
      { source: 'touch', device: 'screen' },
      { source: 'midi', device: 'Some Port' },
    ]);
    expect(calibrationText(devices, [{ source: 'touch', device: 'screen' }])).toBe('touch ✓ · midi needs calibration');
    expect(calibrationText(devices, [{ source: 'midi', device: 'Other Port' }])).toBe(
      'touch needs calibration · midi needs calibration',
    );
    expect(calibrationText([], [])).toBe('');
  });

  it('shows the MIDI input or no midi', () => {
    expect(midiPortText(null)).toBe('no midi');
    expect(midiPortText('Port A')).toBe('Port A');
  });
});
