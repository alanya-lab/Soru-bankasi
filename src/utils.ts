import { TOPICS } from './constants';

export function getTopicDistribution(totalQuestions: number, selectedTopicIds?: number[]): {name: string, count: number}[] {
  let availableTopics = TOPICS;
  if (selectedTopicIds && selectedTopicIds.length > 0) {
    availableTopics = TOPICS.filter(t => selectedTopicIds.includes(t.id));
  }

  const totalWeight = availableTopics.reduce((sum, t) => sum + t.weight, 0);
  
  let distribution: {name: string, count: number}[] = [];
  let remainingQuestions = totalQuestions;

  // First pass: proportional allocation
  for (const topic of availableTopics) {
    const count = Math.floor((topic.weight / totalWeight) * totalQuestions);
    if (count > 0) {
      distribution.push({ name: topic.name, count });
      remainingQuestions -= count;
    }
  }

  // Second pass: distribute remaining questions randomly based on weights
  while (remainingQuestions > 0) {
    let rand = Math.random() * totalWeight;
    for (const topic of availableTopics) {
      rand -= topic.weight;
      if (rand <= 0) {
        const existing = distribution.find(d => d.name === topic.name);
        if (existing) {
          existing.count += 1;
        } else {
          distribution.push({ name: topic.name, count: 1 });
        }
        remainingQuestions -= 1;
        break;
      }
    }
  }

  return distribution;
}
