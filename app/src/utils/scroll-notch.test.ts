import { WHEEL_DELTA, takeWheelNotches } from './scroll-notch';

describe('takeWheelNotches', () => {
  it('stays quiet until a whole notch has accumulated', () => {
    const first = takeWheelNotches(0, 30);
    expect(first.delta).toBe(0);
    expect(first.remainder).toBe(30);

    const second = takeWheelNotches(first.remainder, 30);
    expect(second.delta).toBe(0);
    expect(second.remainder).toBe(60);
  });

  it('emits exactly one notch at the boundary and keeps the leftover', () => {
    const step = takeWheelNotches(100, 40);
    expect(step.delta).toBe(WHEEL_DELTA);
    expect(step.remainder).toBe(20);
  });

  it('emits several notches at once for a fast swipe', () => {
    const step = takeWheelNotches(0, 610);
    expect(step.delta).toBe(5 * WHEEL_DELTA);
    expect(step.remainder).toBe(10);
  });

  it('scrolls up symmetrically with negative travel', () => {
    const step = takeWheelNotches(0, -130);
    expect(step.delta).toBe(-WHEEL_DELTA);
    expect(step.remainder).toBe(-10);

    const carried = takeWheelNotches(step.remainder, -20);
    expect(carried.delta).toBe(0);
    expect(carried.remainder).toBe(-30);
  });

  it('does not accumulate drift when travel is exact', () => {
    let remainder = 0;
    for (let i = 0; i < 6; i += 1) {
      const step = takeWheelNotches(remainder, WHEEL_DELTA);
      expect(step.delta).toBe(WHEEL_DELTA);
      remainder = step.remainder;
    }
    expect(remainder).toBe(0);
  });
});
