/**
 * ZTriage Edge AI Simulator (Zero-Server Triage Mesh)
 * Deterministic NLP triage mapping for evaluating raw symptom strings.
 */

const RISK_DICTIONARY = {
  high: [
    'chest pain', 'heart attack', 'stroke', 'unconscious', 'fainting', 
    'can\'t breathe', 'cannot breathe', 'gasping', 'choking', 'bleeding heavily',
    'seizure', 'paralysis', 'drooping', 'slurred speech', 'suicide', 'anaphylaxis'
  ],
  medium: [
    'fever', 'fracture', 'broken', 'cut', 'headache', 'dizzy', 'vomiting', 
    'nausea', 'abdominal pain', 'stomach pain', 'vision', 'burn', 'swelling'
  ],
  low: [
    'cough', 'cold', 'sore throat', 'rash', 'itchy', 'runny nose', 
    'fatigue', 'tired', 'muscle ache', 'bruise'
  ]
};

const MODIFIERS = {
  amplifiers: ['severe', 'extreme', 'sudden', 'radiating', 'worst', 'intense', 'blood'],
  reducers: ['mild', 'slight', 'chronic', 'recurrent']
};

export function simulateEdgeAI_NLP(symptomRawStr, patientHistory = []) {
  if (!symptomRawStr) return { score: 1, summary: 'No symptoms reported.' };

  const text = symptomRawStr.toLowerCase();
  
  let score = 1; // base score
  const matchedSymptoms = [];
  
  // 1. Keyword extraction & base scoring
  let highestCategory = 'low';

  RISK_DICTIONARY.high.forEach(keyword => {
    if (text.includes(keyword)) {
      score = Math.max(score, 8);
      matchedSymptoms.push(keyword);
      highestCategory = 'high';
    }
  });

  RISK_DICTIONARY.medium.forEach(keyword => {
    if (text.includes(keyword)) {
      score = Math.max(score, 4);
      matchedSymptoms.push(keyword);
      if (highestCategory === 'low') highestCategory = 'medium';
    }
  });

  RISK_DICTIONARY.low.forEach(keyword => {
    if (text.includes(keyword)) {
      score = Math.max(score, 2);
      matchedSymptoms.push(keyword);
    }
  });

  // 2. Modifiers
  let amplified = false;
  MODIFIERS.amplifiers.forEach(mod => {
    if (text.includes(mod)) {
      score += 1;
      amplified = true;
    }
  });

  MODIFIERS.reducers.forEach(mod => {
    if (text.includes(mod)) {
      score = Math.max(1, score - 1.5);
    }
  });

  // 3. History Correlation (Basic Rule Engine)
  const historyText = JSON.stringify(patientHistory).toLowerCase();
  if (matchedSymptoms.some(s => ['chest pain', 'heart attack'].includes(s))) {
    if (historyText.includes('cardiac') || historyText.includes('heart') || historyText.includes('hypertension')) {
      score += 1.5; // High risk correlation
    }
  }

  // Normalize 1-10
  score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));

  // Determine standard triage code
  let triageLevel = 'GREEN (Non-Urgent)';
  if (score >= 8) triageLevel = 'RED (Resuscitation / Emergency)';
  else if (score >= 6) triageLevel = 'ORANGE (Urgent)';
  else if (score >= 4) triageLevel = 'YELLOW (Less Urgent)';

  const clinicalSummary = `Patient reports ${amplified ? 'severe' : 'acute'} symptoms: [${matchedSymptoms.join(', ')}]. ` +
    `Algorithm classification: ${triageLevel}. Confidence Metric: High. Priority routing required.`;

  return {
    score,
    summary: clinicalSummary,
    matchedKeywords: matchedSymptoms
  };
}
