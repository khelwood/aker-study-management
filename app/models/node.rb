class Node < ApplicationRecord
  include Collector
  include AkerPermissionGem::Accessible

  validates :name, presence: true, uniqueness: true
  validates :parent, presence: true, if: :parent_id
  validates_presence_of :description, :allow_blank => true
  validates :cost_code, :presence => true, :allow_blank => true, format: { with: /\AS[0-9]{4}+\z/ }, :on => [:create, :update]

	has_many :nodes, class_name: 'Node', foreign_key: 'parent_id', dependent: :restrict_with_error
	belongs_to :parent, class_name: 'Node', required: false

  before_save :validate_node_blank

	def self.root
		find_by(parent_id: nil)
	end

  def root?
    parent_id.nil?
  end

  def level
    parents.size + 1
  end

  # Gets the parents of a node,
  # starting from root, ending at the node's direct parent
	def parents
    parents = []
    p = parent
    while p do
      parents.push(p)
      p = p.parent
    end
    parents.reverse
  end

  # Create a collection for this node if it doesn't have one
  def set_collection
    self.collection = build_collection if collection.nil? && !@no_collection
  end

  private

  def validate_node_blank
    if self.cost_code.blank?
      self.cost_code = nil
    end
  end

end
