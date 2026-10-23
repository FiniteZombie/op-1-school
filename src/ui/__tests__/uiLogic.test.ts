import { describe, expect, it } from 'vitest';
import { audioStateOf } from '../audioGateLogic';
import { errorText } from '../errorBoundaryText';
import { raisesPowerWarning } from '../powerWarningLogic';
import { calibrationDevices, calibrationText, midiPortText } from '../statusBarText';

describe('audio gate', () => {
  it('is off until initialised, then running or paused by the context state', () => {
    expect(audioStateOf(false, 'running')).toBe('off');
    expect(audioStateOf(true, 'running')).toBe('running');
    expect(audioStateOf(true, 'suspended')).toBe('paused');
    expect(audioStateOf(true, 'interrupted')).toBe('paused');
  });
});

describe('error boundary text', () => {
  it('names the error and its message, or stringifies anything else', () => {
    expect(errorText(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(errorText(new Error(''))).toBe('Error');
    expect(errorText('plain')).toBe('plain');
    expect(errorText(null)).toBe('null');
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
