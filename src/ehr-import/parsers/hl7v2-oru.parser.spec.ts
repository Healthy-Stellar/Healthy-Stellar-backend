import { BadRequestException } from '@nestjs/common';
import { Hl7v2OruParser } from './hl7v2-oru.parser';

const SAMPLE_ORU_R01 = [
  'MSH|^~\\&|LIS|GeneralHospital|EHR|GeneralHospital|20240115143000||ORU^R01|MSG00001|P|2.5.1',
  'PID|1||PATID12345^^^GeneralHospital^MR||DOE^JOHN^A||19800101|M',
  'PV1|1|O|OUTPATIENT^^^GeneralHospital||||1234^SMITH^JANE',
  'OBR|1|ORD12345|FIL67890|24323-8^Comprehensive metabolic panel^LN|||20240115140000|||||||||1234^SMITH^JANE',
  'OBX|1|NM|2823-3^Potassium^LN||4.2|mEq/L|3.5-5.0|N|||F|||20240115141500',
  'OBX|2|NM|2160-0^Creatinine^LN||0.9|mg/dL|0.6-1.2|N|||F|||20240115141500',
  'OBX|3|NM|2339-0^Glucose^LN||145|mg/dL|70-100|H|||F|||20240115141500',
].join('\r');

describe('Hl7v2OruParser', () => {
  let parser: Hl7v2OruParser;

  beforeEach(() => {
    parser = new Hl7v2OruParser();
  });

  it('parses a real-world ORU^R01 message into structured orders/results', () => {
    const [message] = parser.parse(SAMPLE_ORU_R01);

    expect(message.messageType).toBe('ORU^R01');
    expect(message.patientId).toBe('PATID12345');
    expect(message.orders).toHaveLength(1);

    const [order] = message.orders;
    expect(order.placerOrderNumber).toBe('ORD12345');
    expect(order.fillerOrderNumber).toBe('FIL67890');
    expect(order.orderingProvider).toBe('1234');
    expect(order.results).toHaveLength(3);

    const [potassium, creatinine, glucose] = order.results;
    expect(potassium).toMatchObject({
      loincCode: '2823-3',
      observationText: 'Potassium',
      value: '4.2',
      units: 'mEq/L',
      referenceRange: '3.5-5.0',
      abnormalFlag: 'N',
      resultStatus: 'F',
    });
    expect(creatinine.loincCode).toBe('2160-0');
    expect(glucose).toMatchObject({ loincCode: '2339-0', value: '145', abnormalFlag: 'H' });
    expect(glucose.observedAt).toEqual(new Date(Date.UTC(2024, 0, 15, 14, 15, 0)));
  });

  it('supports newline-delimited segments and multiple messages in one payload', () => {
    const messages = parser.parse(`${SAMPLE_ORU_R01}\n${SAMPLE_ORU_R01.replace(/\r/g, '\n')}`);
    expect(messages).toHaveLength(2);
    expect(messages[1].orders[0].results).toHaveLength(3);
  });

  it('rejects a message missing the MSH segment', () => {
    expect(() => parser.parse('PID|1||PATID12345')).toThrow(BadRequestException);
  });

  it('rejects a message missing the PID segment', () => {
    const noPid = SAMPLE_ORU_R01.split('\r').filter((s) => !s.startsWith('PID|')).join('\r');
    expect(() => parser.parse(noPid)).toThrow('Missing required PID segment');
  });

  it('rejects a message missing any OBR segment', () => {
    const noObr = SAMPLE_ORU_R01.split('\r').filter((s) => !s.startsWith('OBR|')).join('\r');
    expect(() => parser.parse(noObr)).toThrow('Missing required OBR segment');
  });

  it('rejects a message missing any OBX segment', () => {
    const noObx = SAMPLE_ORU_R01.split('\r').filter((s) => !s.startsWith('OBX|')).join('\r');
    expect(() => parser.parse(noObx)).toThrow('Missing required OBX segment');
  });

  it('rejects non-ORU message types (e.g. ADT)', () => {
    const adt = SAMPLE_ORU_R01.replace('ORU^R01', 'ADT^A01');
    expect(() => parser.parse(adt)).toThrow(
      'Unsupported HL7 message type "ADT^A01" — only ORU (Observation Result) messages are supported',
    );
  });

  it('rejects an OBX segment with no observation identifier code', () => {
    const badObx = SAMPLE_ORU_R01.replace('2823-3^Potassium^LN', '');
    expect(() => parser.parse(badObx)).toThrow(
      'OBX-3 (Observation Identifier) is missing a code',
    );
  });
});
