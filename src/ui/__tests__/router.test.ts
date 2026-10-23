import { lazy } from 'react';
import { describe, expect, it } from 'vitest';
import type { ModuleDefinition } from '../../types/modules';
import { appPath, hrefFor, isDev, isFast, parseLocation, resolveRoute, visibleModules } from '../router';

const BASE = '/op-1-school/';
const view = lazy(async () => ({ default: () => null }));

const devSpine: ModuleDefinition = { id: 'dev-spine', route: '/dev/spine', title: 't', icon: 'd', component: view, phase: 1, devOnly: true };
const runner: ModuleDefinition = { id: 'runner', route: '/runner', title: 't', icon: 'r', component: view, phase: 2 };
const trainer: ModuleDefinition = { id: 'progression-trainer', route: '/progression-trainer', title: 't', icon: '1', component: view, phase: 2 };
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

  it('/ is the runner when the list has one, else home; an unknown path is not found', () => {
    expect(resolveRoute('/', mods, false)).toEqual({ kind: 'module', module: runner });
    expect(resolveRoute('/', [devSpine, trainer], true)).toEqual({ kind: 'home' });
    expect(resolveRoute('/nope', mods, true)).toEqual({ kind: 'not-found' });
    expect(resolveRoute('/runner', mods, false)).toEqual({ kind: 'module', module: runner });
  });

  it('hrefFor writes the query in insertion order, then dev, then fast', () => {
    expect(hrefFor('/progression-trainer', BASE, true, { mode: 'A3', session: 'x' }, true)).toBe(
      '/op-1-school/progression-trainer?mode=A3&session=x&dev&fast',
    );
    expect(hrefFor('/progression-trainer', BASE, false, { mode: 'A3' }, true)).toBe('/op-1-school/progression-trainer?mode=A3');
    expect(hrefFor('/runner', BASE, false, {}, true)).toBe('/op-1-school/runner');
    expect(hrefFor('/runner', BASE, true, { dev: '1', fast: '1', returnTo: '/runner' })).toBe('/op-1-school/runner?returnTo=%2Frunner&dev');
    expect(hrefFor('/x', BASE, false, { params: '{"form":"phrase"}' })).toBe(
      `/op-1-school/x?params=${encodeURIComponent('{"form":"phrase"}')}`,
    );
  });

  it('isFast needs dev', () => {
    expect(isFast('?dev&fast')).toBe(true);
    expect(isFast('?fast')).toBe(false);
    expect(isFast('?dev')).toBe(false);
  });

  it('parseLocation leaves dev and fast out of query and sets fast', () => {
    expect(parseLocation('/op-1-school/progression-trainer', '?mode=A3&session=x&dev&fast', BASE)).toEqual({
      path: '/progression-trainer',
      dev: true,
      fast: true,
      query: { mode: 'A3', session: 'x' },
    });
    expect(parseLocation('/op-1-school/', '?fast&mode=A0&mode=A1', BASE)).toEqual({
      path: '/',
      dev: false,
      fast: false,
      query: { mode: 'A0' },
    });
    expect(parseLocation('/op-1-school/runner', '', BASE).query).toEqual({});
  });

  it('a query round-trips through hrefFor and parseLocation', () => {
    const query = { mode: 'A6', returnTo: '/runner', params: '{"form":"call-response","a":"b&c=d"}' };
    const href = hrefFor('/progression-trainer', BASE, true, query, true);
    const q = href.indexOf('?');
    expect(parseLocation(href.slice(0, q), href.slice(q), BASE)).toEqual({ path: '/progression-trainer', dev: true, fast: true, query });
  });
});
