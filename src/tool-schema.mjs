// Shared tool input contract for native Pi and MCP hosts.
export const toolSchema = {
  "type": "object",
  "required": [
    "action"
  ],
  "properties": {
    "paths": {"type":"array","items":{"type":"string"},"description":"Optional read paths, e.g. technologies/sessions or diagrams/access. Use [plan] for the full review plan without archived source or discussion history. Omit for the complete record."},
    "catalogKind": {
      "anyOf": [
        {
          "type": "string",
          "const": "nodes"
        },
        {
          "type": "string",
          "const": "document"
        }
      ]
    },
    "action": {
      "anyOf": [
        { "type": "string", "const": "progress" },
        {
          "type": "string",
          "const": "catalog"
        },
        {
          "type": "string",
          "const": "save"
        },
        {
          "type": "string",
          "const": "read"
        },
        {
          "type": "string",
          "const": "list"
        },
        {
          "type": "string",
          "const": "open"
        },
        {
          "type": "string",
          "const": "inbox"
        },
        {
          "type": "string",
          "const": "answer"
        },
        {
          "type": "string",
          "const": "patch"
        }
      ]
    },
    "category": {
      "anyOf": [
        {
          "type": "string",
          "const": "general"
        },
        {
          "type": "string",
          "const": "web"
        },
        {
          "type": "string",
          "const": "software"
        },
        {
          "type": "string",
          "const": "data"
        },
        {
          "type": "string",
          "const": "security"
        },
        {
          "type": "string",
          "const": "operations"
        },
        {
          "type": "string",
          "const": "business"
        }
      ]
    },
    "query": {
      "type": "string"
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "path",
          "value"
        ],
        "properties": {
          "path": {
            "type": "string"
          },
          "value": {
            "type": "string"
          }
        }
      },
      "maxItems": 40
    },
    "questionId": {
      "type": "string"
    },
    "answer": {
      "type": "string"
    },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "label",
          "description"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "tradeoff": {
            "type": "string"
          }
        }
      },
      "maxItems": 4
    },
    "id": {
      "type": "string"
    },
    "expectedRevision": {
      "type": "integer",
      "minimum": 1
    },
    "plan": {
      "type": "object",
      "required": [
        "title",
        "kind",
        "brief"
      ],
      "properties": {
        "schemaVersion": {
          "anyOf": [
            {
              "type": "number",
              "const": 1
            },
            {
              "type": "number",
              "const": 2
            }
          ]
        },
        "workflow": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "type": "string"
            },
            "source": {
              "type": "string"
            },
            "constraints": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "sections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "title",
              "blocks"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "summary": {
                "type": "string"
              },
              "collapsed": {
                "type": "boolean"
              },
              "blocks": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "type"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "type": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": "text"
                        },
                        {
                          "type": "string",
                          "const": "list"
                        },
                        {
                          "type": "string",
                          "const": "table"
                        },
                        {
                          "type": "string",
                          "const": "sequence"
                        },
                        {
                          "type": "string",
                          "const": "code"
                        },
                        {
                          "type": "string",
                          "const": "field"
                        },
                        {
                          "type": "string",
                          "const": "diagrams"
                        },
                        {
                          "type": "string",
                          "const": "tasks"
                        },
                        {
                          "type": "string",
                          "const": "technologies"
                        },
                        {
                          "type": "string",
                          "const": "decisions"
                        }
                      ]
                    },
                    "title": {
                      "type": "string"
                    },
                    "collapsed": {
                      "type": "boolean"
                    },
                    "text": {
                      "type": "string"
                    },
                    "path": {
                      "type": "string"
                    },
                    "ids": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "items": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "id",
                          "label"
                        ],
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "label": {
                            "type": "string"
                          },
                          "detail": {
                            "type": "string"
                          }
                        }
                      }
                    },
                    "columns": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "rows": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "id",
                          "cells"
                        ],
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "cells": {
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "sourceDocument": {
          "type": "object",
          "required": [
            "name",
            "sections"
          ],
          "properties": {
            "name": {
              "type": "string"
            },
            "sections": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "id",
                  "title",
                  "content"
                ],
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "content": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "title": {
          "type": "string"
        },
        "kind": {
          "anyOf": [
            {
              "type": "string",
              "const": "website"
            },
            {
              "type": "string",
              "const": "webapp"
            },
            {
              "type": "string",
              "const": "software"
            },
            {
              "type": "string",
              "const": "other"
            }
          ]
        },
        "brief": {
          "type": "string"
        },
        "diagrams": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "title",
              "description",
              "nodes",
              "layers"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "walkthroughs": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "title",
                    "kind",
                    "intro",
                    "result",
                    "steps"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "kind": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": "journey"
                        },
                        {
                          "type": "string",
                          "const": "reading-guide"
                        }
                      ]
                    },
                    "intro": {
                      "type": "string"
                    },
                    "result": {
                      "type": "string"
                    },
                    "steps": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "id",
                          "title",
                          "explanation",
                          "nodeIds"
                        ],
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "title": {
                            "type": "string"
                          },
                          "explanation": {
                            "type": "string"
                          },
                          "nodeIds": {
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          },
                          "edges": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "required": [
                                "layerId",
                                "from",
                                "to"
                              ],
                              "properties": {
                                "layerId": {
                                  "type": "string"
                                },
                                "from": {
                                  "type": "string"
                                },
                                "to": {
                                  "type": "string"
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              "nodes": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "label",
                    "column",
                    "row"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "label": {
                      "type": "string"
                    },
                    "type": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": "page"
                        },
                        {
                          "type": "string",
                          "const": "person"
                        },
                        {
                          "type": "string",
                          "const": "service"
                        },
                        {
                          "type": "string",
                          "const": "database"
                        },
                        {
                          "type": "string",
                          "const": "auth"
                        },
                        {
                          "type": "string",
                          "const": "payment"
                        },
                        {
                          "type": "string",
                          "const": "storage"
                        },
                        {
                          "type": "string",
                          "const": "message"
                        },
                        {
                          "type": "string",
                          "const": "decision"
                        },
                        {
                          "type": "string",
                          "const": "task"
                        },
                        {
                          "type": "string",
                          "const": "external"
                        },
                        {
                          "type": "string",
                          "const": "goal"
                        },
                        {
                          "type": "string",
                          "const": "milestone"
                        },
                        {
                          "type": "string",
                          "const": "requirement"
                        },
                        {
                          "type": "string",
                          "const": "question"
                        },
                        {
                          "type": "string",
                          "const": "constraint"
                        },
                        {
                          "type": "string",
                          "const": "risk"
                        },
                        {
                          "type": "string",
                          "const": "deliverable"
                        },
                        {
                          "type": "string",
                          "const": "note"
                        },
                        {
                          "type": "string",
                          "const": "section"
                        },
                        {
                          "type": "string",
                          "const": "navigation"
                        },
                        {
                          "type": "string",
                          "const": "cta"
                        },
                        {
                          "type": "string",
                          "const": "form"
                        },
                        {
                          "type": "string",
                          "const": "content"
                        },
                        {
                          "type": "string",
                          "const": "proof"
                        },
                        {
                          "type": "string",
                          "const": "pricing"
                        },
                        {
                          "type": "string",
                          "const": "faq"
                        },
                        {
                          "type": "string",
                          "const": "search"
                        },
                        {
                          "type": "string",
                          "const": "component"
                        },
                        {
                          "type": "string",
                          "const": "client"
                        },
                        {
                          "type": "string",
                          "const": "api"
                        },
                        {
                          "type": "string",
                          "const": "endpoint"
                        },
                        {
                          "type": "string",
                          "const": "module"
                        },
                        {
                          "type": "string",
                          "const": "function"
                        },
                        {
                          "type": "string",
                          "const": "worker"
                        },
                        {
                          "type": "string",
                          "const": "queue"
                        },
                        {
                          "type": "string",
                          "const": "event"
                        },
                        {
                          "type": "string",
                          "const": "webhook"
                        },
                        {
                          "type": "string",
                          "const": "state"
                        },
                        {
                          "type": "string",
                          "const": "scheduler"
                        },
                        {
                          "type": "string",
                          "const": "ai_model"
                        },
                        {
                          "type": "string",
                          "const": "entity"
                        },
                        {
                          "type": "string",
                          "const": "schema"
                        },
                        {
                          "type": "string",
                          "const": "cache"
                        },
                        {
                          "type": "string",
                          "const": "search_index"
                        },
                        {
                          "type": "string",
                          "const": "dataset"
                        },
                        {
                          "type": "string",
                          "const": "backup"
                        },
                        {
                          "type": "string",
                          "const": "permission"
                        },
                        {
                          "type": "string",
                          "const": "secret"
                        },
                        {
                          "type": "string",
                          "const": "policy"
                        },
                        {
                          "type": "string",
                          "const": "boundary"
                        },
                        {
                          "type": "string",
                          "const": "deployment"
                        },
                        {
                          "type": "string",
                          "const": "server"
                        },
                        {
                          "type": "string",
                          "const": "network"
                        },
                        {
                          "type": "string",
                          "const": "monitor"
                        },
                        {
                          "type": "string",
                          "const": "log"
                        },
                        {
                          "type": "string",
                          "const": "test"
                        },
                        {
                          "type": "string",
                          "const": "rollback"
                        },
                        {
                          "type": "string",
                          "const": "product"
                        },
                        {
                          "type": "string",
                          "const": "order"
                        },
                        {
                          "type": "string",
                          "const": "inventory"
                        },
                        {
                          "type": "string",
                          "const": "customer"
                        },
                        {
                          "type": "string",
                          "const": "team"
                        },
                        {
                          "type": "string",
                          "const": "supplier"
                        },
                        {
                          "type": "string",
                          "const": "channel"
                        },
                        {
                          "type": "string",
                          "const": "metric"
                        },
                        {
                          "type": "string",
                          "const": "budget"
                        },
                        {
                          "type": "string",
                          "const": "custom"
                        }
                      ]
                    },
                    "customType": {
                      "type": "object",
                      "required": [
                        "label",
                        "description",
                        "baseType"
                      ],
                      "properties": {
                        "label": {
                          "type": "string"
                        },
                        "description": {
                          "type": "string"
                        },
                        "baseType": {
                          "anyOf": [
                            {
                              "type": "string",
                              "const": "page"
                            },
                            {
                              "type": "string",
                              "const": "person"
                            },
                            {
                              "type": "string",
                              "const": "service"
                            },
                            {
                              "type": "string",
                              "const": "database"
                            },
                            {
                              "type": "string",
                              "const": "auth"
                            },
                            {
                              "type": "string",
                              "const": "payment"
                            },
                            {
                              "type": "string",
                              "const": "storage"
                            },
                            {
                              "type": "string",
                              "const": "message"
                            },
                            {
                              "type": "string",
                              "const": "decision"
                            },
                            {
                              "type": "string",
                              "const": "task"
                            },
                            {
                              "type": "string",
                              "const": "external"
                            },
                            {
                              "type": "string",
                              "const": "goal"
                            },
                            {
                              "type": "string",
                              "const": "milestone"
                            },
                            {
                              "type": "string",
                              "const": "requirement"
                            },
                            {
                              "type": "string",
                              "const": "question"
                            },
                            {
                              "type": "string",
                              "const": "constraint"
                            },
                            {
                              "type": "string",
                              "const": "risk"
                            },
                            {
                              "type": "string",
                              "const": "deliverable"
                            },
                            {
                              "type": "string",
                              "const": "note"
                            },
                            {
                              "type": "string",
                              "const": "section"
                            },
                            {
                              "type": "string",
                              "const": "navigation"
                            },
                            {
                              "type": "string",
                              "const": "cta"
                            },
                            {
                              "type": "string",
                              "const": "form"
                            },
                            {
                              "type": "string",
                              "const": "content"
                            },
                            {
                              "type": "string",
                              "const": "proof"
                            },
                            {
                              "type": "string",
                              "const": "pricing"
                            },
                            {
                              "type": "string",
                              "const": "faq"
                            },
                            {
                              "type": "string",
                              "const": "search"
                            },
                            {
                              "type": "string",
                              "const": "component"
                            },
                            {
                              "type": "string",
                              "const": "client"
                            },
                            {
                              "type": "string",
                              "const": "api"
                            },
                            {
                              "type": "string",
                              "const": "endpoint"
                            },
                            {
                              "type": "string",
                              "const": "module"
                            },
                            {
                              "type": "string",
                              "const": "function"
                            },
                            {
                              "type": "string",
                              "const": "worker"
                            },
                            {
                              "type": "string",
                              "const": "queue"
                            },
                            {
                              "type": "string",
                              "const": "event"
                            },
                            {
                              "type": "string",
                              "const": "webhook"
                            },
                            {
                              "type": "string",
                              "const": "state"
                            },
                            {
                              "type": "string",
                              "const": "scheduler"
                            },
                            {
                              "type": "string",
                              "const": "ai_model"
                            },
                            {
                              "type": "string",
                              "const": "entity"
                            },
                            {
                              "type": "string",
                              "const": "schema"
                            },
                            {
                              "type": "string",
                              "const": "cache"
                            },
                            {
                              "type": "string",
                              "const": "search_index"
                            },
                            {
                              "type": "string",
                              "const": "dataset"
                            },
                            {
                              "type": "string",
                              "const": "backup"
                            },
                            {
                              "type": "string",
                              "const": "permission"
                            },
                            {
                              "type": "string",
                              "const": "secret"
                            },
                            {
                              "type": "string",
                              "const": "policy"
                            },
                            {
                              "type": "string",
                              "const": "boundary"
                            },
                            {
                              "type": "string",
                              "const": "deployment"
                            },
                            {
                              "type": "string",
                              "const": "server"
                            },
                            {
                              "type": "string",
                              "const": "network"
                            },
                            {
                              "type": "string",
                              "const": "monitor"
                            },
                            {
                              "type": "string",
                              "const": "log"
                            },
                            {
                              "type": "string",
                              "const": "test"
                            },
                            {
                              "type": "string",
                              "const": "rollback"
                            },
                            {
                              "type": "string",
                              "const": "product"
                            },
                            {
                              "type": "string",
                              "const": "order"
                            },
                            {
                              "type": "string",
                              "const": "inventory"
                            },
                            {
                              "type": "string",
                              "const": "customer"
                            },
                            {
                              "type": "string",
                              "const": "team"
                            },
                            {
                              "type": "string",
                              "const": "supplier"
                            },
                            {
                              "type": "string",
                              "const": "channel"
                            },
                            {
                              "type": "string",
                              "const": "metric"
                            },
                            {
                              "type": "string",
                              "const": "budget"
                            }
                          ]
                        }
                      }
                    },
                    "column": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 11
                    },
                    "row": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 11
                    }
                  }
                }
              },
              "groups": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "title",
                    "nodeIds"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "color": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": "green"
                        },
                        {
                          "type": "string",
                          "const": "yellow"
                        },
                        {
                          "type": "string",
                          "const": "orange"
                        },
                        {
                          "type": "string",
                          "const": "red"
                        },
                        {
                          "type": "string",
                          "const": "pink"
                        },
                        {
                          "type": "string",
                          "const": "purple"
                        },
                        {
                          "type": "string",
                          "const": "blue"
                        },
                        {
                          "type": "string",
                          "const": "neutral"
                        }
                      ]
                    },
                    "nodeIds": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              },
              "layers": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "title",
                    "description",
                    "nodes",
                    "edges"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "description": {
                      "type": "string"
                    },
                    "color": {
                      "anyOf": [
                        {
                          "type": "string",
                          "const": "green"
                        },
                        {
                          "type": "string",
                          "const": "yellow"
                        },
                        {
                          "type": "string",
                          "const": "orange"
                        },
                        {
                          "type": "string",
                          "const": "red"
                        },
                        {
                          "type": "string",
                          "const": "pink"
                        },
                        {
                          "type": "string",
                          "const": "purple"
                        },
                        {
                          "type": "string",
                          "const": "blue"
                        }
                      ]
                    },
                    "nodes": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "nodeId",
                          "summary",
                          "detail"
                        ],
                        "properties": {
                          "nodeId": {
                            "type": "string"
                          },
                          "summary": {
                            "type": "string"
                          },
                          "detail": {
                            "type": "string"
                          }
                        }
                      }
                    },
                    "edges": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "required": [
                          "from",
                          "to",
                          "label",
                          "detail"
                        ],
                        "properties": {
                          "from": {
                            "type": "string"
                          },
                          "to": {
                            "type": "string"
                          },
                          "label": {
                            "type": "string"
                          },
                          "detail": {
                            "type": "string"
                          },
                          "style": {
                            "anyOf": [
                              {
                                "type": "string",
                                "const": "solid"
                              },
                              {
                                "type": "string",
                                "const": "dashed"
                              }
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "technologies": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "name",
              "role",
              "rationale",
              "tradeoffs",
              "alternatives",
              "dependsOn",
              "impacts",
              "checks"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "name": {
                "type": "string"
              },
              "role": {
                "type": "string"
              },
              "fit": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": "complement"
                  },
                  {
                    "type": "string",
                    "const": "choice"
                  },
                  {
                    "type": "string",
                    "const": "optional"
                  },
                  {
                    "type": "string",
                    "const": "unspecified"
                  }
                ]
              },
              "fitDetail": {
                "type": "string"
              },
              "choiceGroup": {
                "type": "string"
              },
              "status": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": "proposed"
                  },
                  {
                    "type": "string",
                    "const": "confirmed"
                  },
                  {
                    "type": "string",
                    "const": "deferred"
                  }
                ]
              },
              "rationale": {
                "type": "string"
              },
              "tradeoffs": {
                "type": "string"
              },
              "alternatives": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "impacts": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "checks": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "source": {
                "type": "string"
              },
              "versionPlan": {
                "type": "string"
              }
            }
          }
        },
        "objective": {
          "type": "string"
        },
        "success": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "scope": {
          "type": "object",
          "required": [
            "now",
            "later",
            "out"
          ],
          "properties": {
            "now": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "later": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "out": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          }
        },
        "context": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "kind",
              "detail"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "kind": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": "fact"
                  },
                  {
                    "type": "string",
                    "const": "assumption"
                  },
                  {
                    "type": "string",
                    "const": "unknown"
                  }
                ]
              },
              "detail": {
                "type": "string"
              },
              "source": {
                "type": "string"
              }
            }
          }
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "title",
              "summary",
              "why",
              "deliverable",
              "acceptance",
              "dependsOn"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "summary": {
                "type": "string"
              },
              "why": {
                "type": "string"
              },
              "deliverable": {
                "type": "string"
              },
              "acceptance": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "dependsOn": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "status": {
                "anyOf": [
                  {
                    "type": "string",
                    "const": "planned"
                  },
                  {
                    "type": "string",
                    "const": "in_progress"
                  },
                  {
                    "type": "string",
                    "const": "done"
                  },
                  {
                    "type": "string",
                    "const": "blocked"
                  }
                ]
              }
            }
          }
        },
        "questions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "question",
              "why",
              "options"
            ],
            "properties": {
              "id": {
                "type": "string"
              },
              "question": {
                "type": "string"
              },
              "why": {
                "type": "string"
              },
              "recommendation": {
                "type": "string"
              },
              "options": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": [
                    "label",
                    "benefit",
                    "tradeoff"
                  ],
                  "properties": {
                    "label": {
                      "type": "string"
                    },
                    "benefit": {
                      "type": "string"
                    },
                    "tradeoff": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "openBrowser": {
      "type": "boolean"
    },
    "markdownPath": {
      "type": "string",
      "description": "Existing Markdown plan file; required before creating a new review."
    },
    "message": {"type":"string","description":"Short public progress summary. Never private reasoning, credentials or raw tool arguments/results."}
  }
};

// Small transactional operations share the same contract across hosts.
for(const action of ['undo','reconcile'])toolSchema.properties.action.anyOf.push({type:'string',const:action});
toolSchema.properties.undoRevision={type:'integer',minimum:2};
toolSchema.properties.reviewedMarkdown={type:'string',description:'Complete reconciled detailed Markdown. Preserve all original requirements unless explicitly changed. No historical contradictory appendix.'};
toolSchema.properties.sourceEdits={type:'array',maxItems:80,items:{type:'object',required:['find','replace'],properties:{find:{type:'string'},replace:{type:'string'}}},description:'Exact unique replacements in the detailed Markdown for this transaction. Preserve unrelated source content.'};
toolSchema.properties.options.items.properties.prepared={type:'object',required:['revision','operations'],properties:{revision:{type:'integer'},operations:{type:'array',maxItems:250,items:{type:'object',required:['path'],properties:{path:{type:'string'},before:{},value:{},absentBefore:{type:'boolean'},remove:{type:'boolean'}}}},sourceEdits:toolSchema.properties.sourceEdits},description:'Validated changes prepared once, applied locally when selected. before/value are JSON; stable paths. Include corresponding sourceEdits.'};
