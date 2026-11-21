import { evaluateAmountExpression } from './expression';

describe('evaluateAmountExpression', () => {
  const egp = 'EGP'; // 2 minor digits
  const jpy = 'JPY'; // no minor unit
  const kwd = 'KWD'; // 3 minor digits

  it('reads a plain amount in minor units', () => {
    expect(evaluateAmountExpression('120', egp)).toEqual({ status: 'ok', amount: 12000 });
    expect(evaluateAmountExpression('12.5', egp)).toEqual({ status: 'ok', amount: 1250 });
  });

  it('adds up a receipt', () => {
    expect(evaluateAmountExpression('120+35', egp)).toEqual({ status: 'ok', amount: 15500 });
    expect(evaluateAmountExpression('0.1+0.2', egp)).toEqual({ status: 'ok', amount: 30 });
  });

  it('subtracts', () => {
    expect(evaluateAmountExpression('500-120.75', egp)).toEqual({ status: 'ok', amount: 37925 });
  });

  it('does × and ÷ before + and −', () => {
    expect(evaluateAmountExpression('10+2*3', egp)).toEqual({ status: 'ok', amount: 1600 });
    expect(evaluateAmountExpression('100-60/3', egp)).toEqual({ status: 'ok', amount: 8000 });
    expect(evaluateAmountExpression('2*3+4*5', egp)).toEqual({ status: 'ok', amount: 2600 });
  });

  it('works left to right within the same level', () => {
    expect(evaluateAmountExpression('100/4*2', egp)).toEqual({ status: 'ok', amount: 5000 });
    expect(evaluateAmountExpression('10-3-2', egp)).toEqual({ status: 'ok', amount: 500 });
  });

  it('splits a bill exactly when it divides', () => {
    expect(evaluateAmountExpression('300/3', egp)).toEqual({ status: 'ok', amount: 10000 });
  });

  it('rounds a fractional result half-up to the minor unit', () => {
    expect(evaluateAmountExpression('100/3', egp)).toEqual({ status: 'ok', amount: 3333 }); // 33.333…
    expect(evaluateAmountExpression('200/3', egp)).toEqual({ status: 'ok', amount: 6667 }); // 66.666…
    expect(evaluateAmountExpression('0.05/2', egp)).toEqual({ status: 'ok', amount: 3 }); // 0.025 → 0.03
    expect(evaluateAmountExpression('5/2', jpy)).toEqual({ status: 'ok', amount: 3 }); // 2.5 → 3
    expect(evaluateAmountExpression('1/8', kwd)).toEqual({ status: 'ok', amount: 125 });
    expect(evaluateAmountExpression('1/16', kwd)).toEqual({ status: 'ok', amount: 63 }); // 0.0625 → 0.063
  });

  it('rounds only the result, so thirds add back up to the whole', () => {
    expect(evaluateAmountExpression('10/3+10/3+10/3', egp)).toEqual({ status: 'ok', amount: 1000 });
  });

  it('can produce zero or a negative result (the caller decides whether to save it)', () => {
    expect(evaluateAmountExpression('5-5', egp)).toEqual({ status: 'ok', amount: 0 });
    expect(evaluateAmountExpression('5-8', egp)).toEqual({ status: 'ok', amount: -300 });
  });

  it('calls an expression ending in an operator incomplete', () => {
    expect(evaluateAmountExpression('120+', egp)).toEqual({ status: 'incomplete' });
    expect(evaluateAmountExpression('', egp)).toEqual({ status: 'incomplete' });
  });

  it('reports division by zero', () => {
    expect(evaluateAmountExpression('120/0', egp)).toEqual({ status: 'divisionByZero' });
    expect(evaluateAmountExpression('120/0.00+5', egp)).toEqual({ status: 'divisionByZero' });
  });

  it('accepts a trailing decimal point on a number', () => {
    expect(evaluateAmountExpression('12.+3', egp)).toEqual({ status: 'ok', amount: 1500 });
  });

  it('rejects anything that is not numbers joined by + − × ÷', () => {
    expect(evaluateAmountExpression('-5', egp)).toEqual({ status: 'invalid' });
    expect(evaluateAmountExpression('5++3', egp)).toEqual({ status: 'invalid' });
    expect(evaluateAmountExpression('(5+3)', egp)).toEqual({ status: 'invalid' });
    expect(evaluateAmountExpression('1.2.3', egp)).toEqual({ status: 'invalid' });
  });

  it('rejects a number with more fraction digits than the currency has', () => {
    expect(evaluateAmountExpression('1.234', egp)).toEqual({ status: 'invalid' });
  });

  it('says when the result is too large to store exactly', () => {
    expect(evaluateAmountExpression('9999999999999*9999', egp)).toEqual({ status: 'tooLarge' });
  });
});
