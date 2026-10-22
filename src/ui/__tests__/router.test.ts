import { lazy } from 'react';
import { describe, expect, it } from 'vitest';
import type { ModuleDefinition } from '../../types/modules';
import { appPath, hrefFor, isDev, resolveRoute, visibleModules } from '../router';

const BASE = '/op-1-school/';
const view = lazy(async () => ({ default: () => null }));

const devSpine: ModuleDefinition = { id: 'dev-spine', route: '/dev/spine', title: 't', icon: 'd', component: view, phase: 1, devOnly: true };
const runner: ModuleDefinition = { id: 'runner', route: '/runner', title: 't', icon: 'r', component: view, phase: 2 };
const mods = [devSpine, runner];

describe('router', () => {
  it('appPath strips the base and trailing slashes', () => {
    expect(appPath('/op-1-school/', BASE)).toBe('/');
    expect(appPath('/op-1-school', BASE)).toBe('/');
    expect(appPath('/op-1-school/dev/spine', BASE)).toBe('/dev/spine');
    expect(appPath('/op-1-school/dev/spine/', BASE)).toBe('/dev/spine');
    expect(appPath('/op-1-schoolx', BASE)).toBe('/op-1-schoolx');
    expect(appPath('/nope', '/')).toBe('/nope');
  });

  it('isDev reads ?dev with or without a value', () => {
    expect(isDev('?dev')).toBe(true);
    expect(isDev('?a=1&dev=1')).toBe(true);
    expect(isDev('')).toBe(false);
    expect(isDev('?devx')).toBe(false);
  });

  it('hrefFor keeps ?dev', () => {
    expect(hrefFor('/dev/spine', BASE, true)).toBe('/op-1-school/dev/spine?dev');
    expect(hrefFor('/', BASE, false)).toBe('/op-1-school/');
    expect(hrefFor('/runner', '/op-1-school', false)).toBe('/op-1-school/runner');
  });

  it('devOnly modules are hidden, nav and route, without ?dev', () => {
    expect(visibleModules(mods, false)).toEqual([runner]);
    expect(visibleModules(mods, true)).toEqual(mods);
    expect(resolveRoute('/dev/spine', mods, false)).toEqual({ kind: 'not-found' });
    expect(resolveRoute('/dev/spine', mods, true)).toEqual({ kind: 'module', module: devSpine });
  });

  it('/ is home and an unknown path is not found', () => {
    expect(resolveRoute('/', mods, false)).toEqual({ kind: 'home' });
    expect(resolveRoute('/nope', mods, true)).toEqual({ kind: 'not-found' });
    expect(resolveRoute('/runner', mods, false)).toEqual({ kind: 'module', module: runner });
  });
});
