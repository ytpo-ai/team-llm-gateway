import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Model as ModelEntity,
  ModelDocument,
  ModelStatus,
} from '../models/schemas/model.schema.js';
import { SCENARIOS, type ScenarioTemplate } from './scenarios.js';

export interface ScenarioView {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  cacheHint: string;
  tips: string[];
  examples: string[];
}

export interface ModelRef {
  id: string;
  modelId: string;
  displayName: string;
  multiplier: number;
  capabilities: string[];
}

export interface Recommendation {
  scenario: ScenarioView;
  primary: ModelRef | null;
  alternatives: ModelRef[];
  partialMatches: ModelRef[];
}

@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(ModelEntity.name)
    private readonly modelModel: Model<ModelDocument>,
  ) {}

  listScenarios(): ScenarioView[] {
    return SCENARIOS.map((scenario) => this.toScenarioView(scenario));
  }

  async recommend(
    tenantId: string,
    teamId: string,
    scenarioId: string,
  ): Promise<Recommendation> {
    const scenario = SCENARIOS.find((item) => item.id === scenarioId);
    if (!scenario) {
      throw new NotFoundException('场景不存在');
    }

    const models = await this.modelModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        status: ModelStatus.ACTIVE,
      })
      .exec();

    const required = scenario.requiredCapabilities;
    const matches = (model: ModelDocument) =>
      required.every((capability) => model.capabilities.includes(capability));
    const matchedCount = (model: ModelDocument) =>
      required.filter((capability) => model.capabilities.includes(capability))
        .length;

    const fullMatches = models.filter(matches).sort((a, b) => a.multiplier - b.multiplier);
    const primary = fullMatches.length > 0 ? this.toModelRef(fullMatches[0]) : null;
    const alternatives = fullMatches.slice(1).map((model) => this.toModelRef(model));

    const partialMatches = models
      .filter((model) => !matches(model) && matchedCount(model) > 0)
      .sort(
        (a, b) =>
          matchedCount(b) - matchedCount(a) || a.multiplier - b.multiplier,
      )
      .map((model) => this.toModelRef(model));

    return {
      scenario: this.toScenarioView(scenario),
      primary,
      alternatives,
      partialMatches,
    };
  }

  private toScenarioView(scenario: ScenarioTemplate): ScenarioView {
    return {
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      requiredCapabilities: scenario.requiredCapabilities,
      optionalCapabilities: scenario.optionalCapabilities,
      cacheHint: scenario.cacheHint,
      tips: scenario.tips,
      examples: scenario.examples,
    };
  }

  private toModelRef(model: ModelDocument): ModelRef {
    return {
      id: String(model._id),
      modelId: model.modelId,
      displayName: model.displayName,
      multiplier: model.multiplier,
      capabilities: model.capabilities,
    };
  }
}
