import { parseAuthIdentifier } from './auth-identifier';

describe('parseAuthIdentifier', () => {
  it('recognizes and normalizes email identifiers', () => {
    expect(parseAuthIdentifier('  Player.Name@Example.COM  ')).toEqual({
      type: 'email',
      value: 'player.name@example.com'
    });
  });

  it('normalizes local and international Philippine mobile formats', () => {
    expect(parseAuthIdentifier('0917 123 4567')).toEqual({
      type: 'phone',
      value: '+639171234567'
    });
    expect(parseAuthIdentifier('+63917-123-4567')).toEqual({
      type: 'phone',
      value: '+639171234567'
    });
  });

  it('rejects identifiers that do not match supported formats', () => {
    expect(parseAuthIdentifier('not an identifier')).toEqual({
      type: 'invalid',
      value: 'not an identifier'
    });
  });
});