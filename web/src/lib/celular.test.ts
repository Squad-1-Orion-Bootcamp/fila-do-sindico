import { describe, expect, it } from 'vitest'
import { deWhatsApp, formatarCelular, paraWhatsApp } from './celular'

describe('paraWhatsApp', () => {
  it('aceita o número com máscara', () => {
    expect(paraWhatsApp('(11) 99999-8888')).toBe('5511999998888')
  })

  it('aceita o número sem máscara', () => {
    expect(paraWhatsApp('11999998888')).toBe('5511999998888')
  })

  it('aceita o número com 55 na frente', () => {
    expect(paraWhatsApp('5511999998888')).toBe('5511999998888')
    expect(paraWhatsApp('+55 (11) 99999-8888')).toBe('5511999998888')
  })

  it('aceita o DDD 55 sem código do país', () => {
    expect(paraWhatsApp('(55) 99999-8888')).toBe('5555999998888')
  })

  it('recusa o número sem DDD', () => {
    expect(paraWhatsApp('99999-8888')).toBeNull()
  })

  it('recusa DDD começando com 0', () => {
    expect(paraWhatsApp('(01) 99999-8888')).toBeNull()
    expect(paraWhatsApp('011999998888')).toBeNull()
  })

  it('recusa DDD com 0 no segundo dígito, como o banco', () => {
    expect(paraWhatsApp('(20) 99999-8888')).toBeNull()
  })

  it('recusa o celular sem o 9', () => {
    expect(paraWhatsApp('(11) 8888-7777')).toBeNull()
    expect(paraWhatsApp('(11) 89999-8888')).toBeNull()
  })

  it('recusa dígitos a mais', () => {
    expect(paraWhatsApp('(11) 99999-88880')).toBeNull()
    expect(paraWhatsApp('55119999988880')).toBeNull()
  })

  it('recusa letras e caracteres extras', () => {
    expect(paraWhatsApp('(11) 99999-888a')).toBeNull()
    expect(paraWhatsApp('11 99999/8888')).toBeNull()
    expect(paraWhatsApp('tel: 11999998888')).toBeNull()
  })

  it('recusa o valor vazio', () => {
    expect(paraWhatsApp('')).toBeNull()
    expect(paraWhatsApp('   ')).toBeNull()
  })
})

describe('formatarCelular', () => {
  it('monta a máscara enquanto o usuário digita', () => {
    expect(formatarCelular('')).toBe('')
    expect(formatarCelular('1')).toBe('(1')
    expect(formatarCelular('11')).toBe('(11')
    expect(formatarCelular('119')).toBe('(11) 9')
    expect(formatarCelular('1199999')).toBe('(11) 99999')
    expect(formatarCelular('11999998')).toBe('(11) 99999-8')
    expect(formatarCelular('11999998888')).toBe('(11) 99999-8888')
  })

  it('corta no 11º dígito', () => {
    expect(formatarCelular('119999988887')).toBe('(11) 99999-8888')
  })

  it('ignora o que não é dígito', () => {
    expect(formatarCelular('(11) 9a9999-8888')).toBe('(11) 99999-8888')
  })

  it('tira o 55 de um número colado completo', () => {
    expect(formatarCelular('+55 11 99999-8888')).toBe('(11) 99999-8888')
  })
})

describe('deWhatsApp', () => {
  it('formata o número do banco para exibir', () => {
    expect(deWhatsApp('5511999998888')).toBe('(11) 99999-8888')
  })

  it('devolve como está um valor fora do formato', () => {
    expect(deWhatsApp('11999998888')).toBe('11999998888')
  })

  it('faz a ida e a volta com paraWhatsApp', () => {
    for (const digitado of ['(11) 99999-8888', '21987654321', '+55 (55) 91234-5678']) {
      const noBanco = paraWhatsApp(digitado)
      expect(noBanco).not.toBeNull()
      expect(paraWhatsApp(deWhatsApp(noBanco as string))).toBe(noBanco)
    }
    expect(deWhatsApp(paraWhatsApp('(11) 99999-8888') as string)).toBe('(11) 99999-8888')
  })
})
