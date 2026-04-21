import SectionWrapper from '../components/SectionWrapper'
import SkillBadge from '../components/SkillBadge'
import { skills } from '../data/content'

function Skills() {
  return (
    <SectionWrapper id="skills" title="skills">
      <div className="space-y-8">
        {skills.map((group, idx) => {
          const accent = idx % 2 === 0 ? 'green' : 'cyan'
          const headerColor =
            accent === 'green' ? 'text-accent-green' : 'text-accent-cyan'

          return (
            <div key={group.category}>
              <h3
                className={`font-mono text-sm sm:text-base mb-3 ${headerColor}`}
              >
                <span className="text-text-secondary">//</span>{' '}
                {group.category.toLowerCase()}
              </h3>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {group.items.map((item) => (
                  <SkillBadge key={item} accent={accent}>
                    {item}
                  </SkillBadge>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </SectionWrapper>
  )
}

export default Skills